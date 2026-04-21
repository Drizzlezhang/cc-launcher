import { execa } from 'execa';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
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

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.drizzle.json');

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

function updateSettingsForNewApi(settings, { baseurl, apikey, selectedModel }) {
  if (!settings.env) {
    settings.env = {};
  }
  delete settings.env.CLAUDE_CODE_USE_VERTEX;
  delete settings.env.CLOUD_ML_REGION;
  delete settings.env.ANTHROPIC_VERTEX_PROJECT_ID;
  delete settings.env.GOOGLE_APPLICATION_CREDENTIALS;

  settings.env.ANTHROPIC_BASE_URL = baseurl;
  settings.env.ANTHROPIC_AUTH_TOKEN = apikey;
  settings.env.ANTHROPIC_MODEL = selectedModel;
  return settings;
}

function updateSettingsForVertex(settings, { projectId, region, vertexModel, serviceAccountKeyPath }) {
  if (!settings.env) {
    settings.env = {};
  }
  delete settings.env.ANTHROPIC_BASE_URL;
  delete settings.env.ANTHROPIC_AUTH_TOKEN;

  settings.env.CLAUDE_CODE_USE_VERTEX = '1';
  settings.env.CLOUD_ML_REGION = region || 'global';
  settings.env.ANTHROPIC_VERTEX_PROJECT_ID = projectId;
  settings.env.ANTHROPIC_MODEL = vertexModel;

  if (serviceAccountKeyPath) {
    settings.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountKeyPath;
  }

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

  // Update settings.drizzle.json
  showStatus('Updating Claude settings...', 'saving');

  const settings = readSettings();

  if (channel === 'vertex') {
    updateSettingsForVertex(settings, config);
  } else {
    updateSettingsForNewApi(settings, config);
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
