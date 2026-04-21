import { execa } from 'execa';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import axios from 'axios';
import {
  getConfig,
  hasValidConfig,
  hasWorkConfig,
  hasPersonalConfig,
  getChannel,
  getMode,
  setMode,
} from './config.js';
import { runConfigFlow } from './config-flow.js';
import { showLaunchInfo, showStatus } from './banner.js';
import { checkForUpdate, performUpdate } from './update.js';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.drizzle.json');

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
  if (!existsSync(SETTINGS_PATH)) {
    return { env: {}, permissions: { allow: [] } };
  }
  try {
    const content = readFileSync(SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { env: {}, permissions: { allow: [] } };
  }
}

function writeSettings(settings) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
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

async function selectModeOnLaunch() {
  const workValid = hasWorkConfig();
  const personalValid = hasPersonalConfig();

  if (workValid && personalValid) {
    // 两者都有效，询问选择
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: '👤 Select mode to use:',
        choices: [
          { name: `Personal ${chalk.gray('(your config)')}`, value: 'personal' },
          { name: `Work ${chalk.gray('(company environment)')}`, value: 'work' },
        ],
        default: getMode(),
      },
    ]);
    return mode;
  } else if (workValid) {
    return 'work';
  } else if (personalValid) {
    return 'personal';
  }
  return null;
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

  // 检查配置状态并选择模式
  const mode = await selectModeOnLaunch();

  if (!mode) {
    // 没有任何有效配置
    showStatus('No configuration found. Starting setup...', 'warning');
    await runConfigFlow();

    if (!hasValidConfig()) {
      showStatus('Configuration failed. Exiting.', 'error');
      process.exit(1);
    }
  } else {
    setMode(mode);
  }

  const config = getConfig();
  const channel = getChannel();
  const currentMode = getMode();

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

  // Update settings.drizzle.json
  showStatus('Updating Claude settings...', 'saving');

  const settings = readSettings();

  if (channel === 'vertex') {
    updateSettingsForVertex(settings, config);
  } else if (channel === 'kimi') {
    updateSettingsForKimi(settings, config);
  } else {
    updateSettingsForNewApi(settings, { ...config, mode: currentMode });
  }

  writeSettings(settings);

  // Show launch info
  showLaunchInfo(currentMode, channel, config);

  // Launch claude
  showStatus('Starting Claude Code...', 'launching');
  console.log();

  try {
    await execa('claude', ['--settings', SETTINGS_PATH], {
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
  }
}
