import { execa } from 'execa';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import axios from 'axios';
import { runSessionConfigFlow } from './config-flow.js';
import { showLaunchInfo, showStatus } from './banner.js';
import { checkForUpdate, performUpdate } from './update.js';
import {
  startProxySidecar,
  stopProxySidecar,
  probeProxyAuth,
  startTrafficLoggerProxy,
} from './proxy.js';

const GLOBAL_SETTINGS_PATH = join(homedir(), '.claude', 'settings.drizzle.json');
const SESSION_SETTINGS_DIR = join(homedir(), '.claude', 'sessions', 'cc-launcher');

// 需要清理的渠道相关环境变量
const CHANNEL_ENV_VARS = [
  'VERTEX_PROJECT',
  'VERTEX_LOCATION',
  'USE_VERTEX_AUTH',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'NODE_TLS_REJECT_UNAUTHORIZED',
];

/**
 * 清理渠道相关的环境变量
 */
function clearChannelEnv(settings) {
  if (!settings.env) return;
  CHANNEL_ENV_VARS.forEach(v => delete settings.env[v]);
}

/**
 * 检查代理是否可用
 */
async function checkProxyHealth(proxyUrl) {
  try {
    const response = await axios.get(`${proxyUrl}/health`, {
      timeout: 3000,
      validateStatus: () => true,
    });
    return response.status < 500;
  } catch {
    // 尝试根路径
    try {
      await axios.get(proxyUrl, { timeout: 3000, validateStatus: () => true });
      return true;
    } catch {
      return false;
    }
  }
}

function readSettings() {
  if (!existsSync(GLOBAL_SETTINGS_PATH)) {
    return { env: {}, permissions: { allow: [] } };
  }
  try {
    const content = readFileSync(GLOBAL_SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { env: {}, permissions: { allow: [] } };
  }
}

function createSessionSettingsFile(settings) {
  mkdirSync(SESSION_SETTINGS_DIR, { recursive: true });
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionPath = join(SESSION_SETTINGS_DIR, `${sessionId}.json`);
  writeFileSync(sessionPath, JSON.stringify(settings, null, 2), 'utf-8');
  return sessionPath;
}

function updateSettingsForNewApi(settings, { baseurl, apikey, selectedModel, mode }) {
  if (!settings.env) {
    settings.env = {};
  }
  clearChannelEnv(settings);

  settings.env.ANTHROPIC_BASE_URL = baseurl;
  settings.env.ANTHROPIC_AUTH_TOKEN = apikey;
  settings.env.ANTHROPIC_MODEL = selectedModel;

  // Work 模式下允许自签名证书
  if (mode === 'work') {
    settings.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  return settings;
}

function updateSettingsForVertex(settings, { projectId, region, vertexModel, proxyUrl }) {
  if (!settings.env) {
    settings.env = {};
  }
  clearChannelEnv(settings);

  // Vertex AI (Gemini) 通过代理使用
  settings.env.ANTHROPIC_BASE_URL = proxyUrl || 'http://localhost:8082';
  settings.env.ANTHROPIC_MODEL = vertexModel;
  // 代理需要的 Vertex 配置
  settings.env.VERTEX_PROJECT = projectId;
  settings.env.VERTEX_LOCATION = region || 'global';
  settings.env.USE_VERTEX_AUTH = 'true';

  return settings;
}

function updateSettingsForKimi(settings, { kimiApikey, selectedModel }) {
  if (!settings.env) {
    settings.env = {};
  }
  clearChannelEnv(settings);

  settings.env.ANTHROPIC_BASE_URL = 'https://api.kimi.com/coding/';
  settings.env.ANTHROPIC_API_KEY = kimiApikey;
  settings.env.ANTHROPIC_AUTH_TOKEN = kimiApikey;
  settings.env.ANTHROPIC_MODEL = selectedModel;
  return settings;
}

function updateSettingsForCoco(settings, sidecar) {
  if (!settings.env) {
    settings.env = {};
  }
  clearChannelEnv(settings);

  settings.env.ANTHROPIC_BASE_URL = sidecar.baseUrl;
  settings.env.ANTHROPIC_AUTH_TOKEN = sidecar.authToken || '';
  if (typeof sidecar?.close === 'function') {
    settings.env.ANTHROPIC_MODEL = 'coco-cli';
  } else {
    delete settings.env.ANTHROPIC_MODEL;
  }
  settings.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  return settings;
}

function updateSettingsForCodin(settings, sidecar) {
  if (!settings.env) {
    settings.env = {};
  }
  clearChannelEnv(settings);

  settings.env.ANTHROPIC_BASE_URL = sidecar.baseUrl;
  settings.env.ANTHROPIC_AUTH_TOKEN = sidecar.authToken || '';
  if (typeof sidecar?.close === 'function') {
    settings.env.ANTHROPIC_MODEL = 'codin-cli';
  } else {
    delete settings.env.ANTHROPIC_MODEL;
  }
  settings.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  return settings;
}


export async function launchClaude() {
  // 检查更新
  const updateInfo = await checkForUpdate();
  if (updateInfo.hasUpdate) {
    console.log();
    console.log(chalk.yellow(`  📦 New version available: ${chalk.bold(`v${updateInfo.latestVersion}`)} (current: v${updateInfo.currentVersion})`));
    console.log();

    const { shouldUpdate } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldUpdate',
        message: 'Update to the latest version?',
        default: true,
      },
    ]);

    if (shouldUpdate) {
      const success = await performUpdate(updateInfo.latestVersion);
      if (success) {
        console.log(chalk.gray('  Please restart cc-launcher to use the new version.'));
        console.log();
        process.exit(0);
      }
    }
    console.log();
  }

  // 每次启动都走会话级配置（不持久化）
  const config = await runSessionConfigFlow();
  if (!config) {
    showStatus('Configuration cancelled or invalid. Exiting.', 'error');
    process.exit(1);
  }

  const channel = config.channel;
  const currentMode = config.mode;
  let sidecar = null;
  let proxyLogger = null;

  // Vertex 代理健康检查
  if (channel === 'vertex' && config.proxyUrl) {
    showStatus('Checking proxy connection...', 'loading');
    const proxyOk = await checkProxyHealth(config.proxyUrl);
    if (!proxyOk) {
      console.log();
      showStatus(`Proxy at ${config.proxyUrl} is not responding.`, 'error');
      console.log(chalk.gray('  Please start claude-code-proxy first:'));
      console.log(chalk.cyan('  git clone https://github.com/1rgs/claude-code-proxy'));
      console.log(chalk.cyan('  uv run uvicorn server:app --host 0.0.0.0 --port 8082'));
      console.log();
      process.exit(1);
    }
    showStatus('Proxy connection OK', 'success');
  }

  if (channel === 'coco' || channel === 'codin') {
    showStatus(`Starting ${channel} proxy sidecar...`, 'loading');
    try {
      sidecar = await startProxySidecar(channel);
      showStatus(`${channel} proxy is running`, 'success');

      showStatus('Probing proxy auth...', 'loading');
      const probe = await probeProxyAuth(sidecar.baseUrl, sidecar.authToken);
      if (!probe.ok) {
        console.log();
        showStatus(
          `Proxy auth probe failed (status ${probe.status}). Response: ${probe.bodyPreview || 'empty'}`,
          'error',
        );
        process.exit(1);
      }

      showStatus(`Proxy auth OK (${probe.status})`, 'success');

      if (process.env.CC_LAUNCHER_PROXY_LOG === '1') {
        proxyLogger = await startTrafficLoggerProxy(sidecar.baseUrl, sidecar.authToken, probe.headers);
        showStatus(`Proxy traffic logger enabled at ${proxyLogger.baseUrl}`, 'success');
      }
    } catch (error) {
      console.log();
      showStatus(`Failed to start ${channel} proxy: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  // Update settings.drizzle.json
  showStatus('Updating Claude settings...', 'saving');

  const settings = readSettings();

  if (channel === 'vertex') {
    updateSettingsForVertex(settings, config);
  } else if (channel === 'kimi') {
    updateSettingsForKimi(settings, config);
  } else if (channel === 'coco') {
    updateSettingsForCoco(settings, {
      ...sidecar,
      baseUrl: proxyLogger?.baseUrl || sidecar.baseUrl,
    });
  } else if (channel === 'codin') {
    updateSettingsForCodin(settings, {
      ...sidecar,
      baseUrl: proxyLogger?.baseUrl || sidecar.baseUrl,
    });
  } else {
    updateSettingsForNewApi(settings, { ...config, mode: currentMode });
  }

  const sessionSettingsPath = createSessionSettingsFile(settings);

  // Show launch info
  showLaunchInfo(currentMode, channel, config);

  // Launch claude
  showStatus('Starting Claude Code...', 'launching');
  console.log();

  try {
    await execa('claude', ['--settings', sessionSettingsPath], {
      stdio: 'inherit',
      preferLocal: false,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      showStatus('Claude CLI not found. Please install it first:', 'error');
      console.log(chalk.gray('  npm install -g @anthropic-ai/claude-code'));
      console.log();
      process.exit(1);
    }
    if (error.exitCode !== undefined && error.exitCode !== 0) {
      console.log();
      showStatus(`Claude exited with code ${error.exitCode}`, 'warning');
    }
  } finally {
    if (proxyLogger) {
      await proxyLogger.close();
    }
    if (sidecar) {
      await stopProxySidecar(sidecar);
    }
  }
}
