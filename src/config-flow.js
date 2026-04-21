import inquirer from 'inquirer';
import chalk from 'chalk';
import { getConfig, setConfig } from './config.js';
import { fetchModels } from './api.js';
import {
  VERTEX_MODELS,
  VERTEX_REGIONS,
  hasAdcConfigured,
  getCurrentProjectId,
  isGcloudInstalled,
} from './vertex.js';
import {
  showConfigBanner,
  showStatus,
  showWarning,
  showConfigSaved,
} from './banner.js';

async function fetchAndSelectModel(baseurl, apikey, currentConfig) {
  console.log();
  showStatus('Fetching available models...', 'loading');

  let models;
  try {
    models = await fetchModels(baseurl, apikey);
    if (models.length === 0) {
      console.log();
      showWarning('No models found from this endpoint.');
      process.exit(1);
    }
    showStatus(`Found ${models.length} models`, 'success');
  } catch (error) {
    console.log();
    showStatus(error.message, 'error');
    process.exit(1);
  }

  console.log();

  const pageSize = Math.min(12, models.length);
  const modelAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      message: '🤖 Choose your default model:',
      choices: models,
      default: currentConfig.selectedModel || models[0],
      pageSize,
    },
  ]);

  return modelAnswer.selectedModel;
}

async function runWorkConfig(currentConfig) {
  // 工作模式：直接配置 NewAPI
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseurl',
      message: '🔗 Enter work API endpoint URL:',
      default: currentConfig.baseurl || '',
      validate: (input) => {
        if (!input.trim()) return 'Endpoint URL is required';
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'password',
      name: 'apikey',
      message: '🔑 Enter work API key:',
      default: currentConfig.apikey || '',
      validate: (input) => {
        if (!input.trim()) return 'API key is required';
        return true;
      },
    },
  ]);

  const selectedModel = await fetchAndSelectModel(answers.baseurl, answers.apikey, currentConfig);

  setConfig({
    mode: 'work',
    channel: 'newapi',
    baseurl: answers.baseurl,
    apikey: answers.apikey,
    selectedModel,
  });
}

async function runNewApiConfig(currentConfig) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseurl',
      message: '🔗 Enter API endpoint URL:',
      default: currentConfig.baseurl || '',
      validate: (input) => {
        if (!input.trim()) return 'Endpoint URL is required';
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'password',
      name: 'apikey',
      message: '🔑 Enter your API key:',
      default: currentConfig.apikey || '',
      validate: (input) => {
        if (!input.trim()) return 'API key is required';
        return true;
      },
    },
  ]);

  const selectedModel = await fetchAndSelectModel(answers.baseurl, answers.apikey, currentConfig);

  setConfig({
    mode: 'personal',
    channel: 'newapi',
    baseurl: answers.baseurl,
    apikey: answers.apikey,
    selectedModel,
  });
}

async function runVertexConfig(currentConfig) {
  if (!isGcloudInstalled()) {
    console.log();
    showWarning('gcloud CLI is not installed.');
    console.log(chalk.gray('  Install from: https://cloud.google.com/sdk/docs/install'));
    console.log();

    const { continueAnyway } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAnyway',
        message: 'Continue without gcloud CLI? (You will need to set up credentials manually)',
        default: false,
      },
    ]);

    if (!continueAnyway) {
      process.exit(1);
    }
  }

  const adcConfigured = hasAdcConfigured();
  if (!adcConfigured) {
    console.log();
    showWarning('Application Default Credentials (ADC) not configured.');
    console.log(chalk.gray('  Run: gcloud auth application-default login'));
    console.log();

    const { setupNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setupNow',
        message: 'Run gcloud auth now?',
        default: true,
      },
    ]);

    if (setupNow) {
      console.log();
      showStatus('Opening browser for authentication...', 'loading');
      console.log();

      try {
        const { execSync } = await import('child_process');
        execSync('gcloud auth application-default login', { stdio: 'inherit' });
        showStatus('Authentication successful!', 'success');
      } catch (error) {
        showStatus('Authentication failed. You can set up credentials later.', 'warning');
      }
    }
  }

  const defaultProjectId = getCurrentProjectId();
  console.log();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectId',
      message: '📊 Enter GCP Project ID:',
      default: currentConfig.projectId || defaultProjectId || '',
      validate: (input) => {
        if (!input.trim()) return 'Project ID is required';
        return true;
      },
    },
    {
      type: 'list',
      name: 'region',
      message: '🌍 Choose a region:',
      choices: VERTEX_REGIONS.map((r) => ({
        name: `${r.name} ${chalk.gray(`(${r.description})`)}`,
        value: r.id,
      })),
      default: currentConfig.region || 'global',
    },
    {
      type: 'list',
      name: 'vertexModel',
      message: '🤖 Choose Claude model:',
      choices: VERTEX_MODELS.map((m) => ({
        name: `${m.name} ${chalk.gray(`(${m.context})`)}`,
        value: m.id,
      })),
      default: currentConfig.vertexModel || 'claude-sonnet-4-6',
    },
    {
      type: 'input',
      name: 'serviceAccountKeyPath',
      message: '🔐 Service Account Key path (optional, press Enter to use ADC):',
      default: currentConfig.serviceAccountKeyPath || '',
    },
  ]);

  setConfig({
    mode: 'personal',
    channel: 'vertex',
    projectId: answers.projectId,
    region: answers.region,
    vertexModel: answers.vertexModel,
    serviceAccountKeyPath: answers.serviceAccountKeyPath || undefined,
  });
}

export async function runConfigFlow() {
  showConfigBanner();

  const currentConfig = getConfig();

  // Step 1: 模式选择
  const modeAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: '👤 Select mode:',
      choices: [
        { name: `Personal ${chalk.gray('(configure yourself)')}`, value: 'personal' },
        { name: `Work ${chalk.gray('(company environment)')}`, value: 'work' },
      ],
      default: currentConfig.mode || 'personal',
    },
  ]);

  console.log();

  if (modeAnswer.mode === 'work') {
    // 工作模式：直接配置 NewAPI
    await runWorkConfig(currentConfig);
  } else {
    // 个人模式：渠道选择
    const channelAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'channel',
        message: '🌐 Choose your API provider:',
        choices: [
          { name: `NewAPI ${chalk.gray('(OpenAI-compatible)')}`, value: 'newapi' },
          { name: `Google Vertex AI ${chalk.gray('(GCP)')}`, value: 'vertex' },
        ],
        default: currentConfig.channel || 'newapi',
      },
    ]);

    console.log();

    if (channelAnswer.channel === 'vertex') {
      await runVertexConfig(currentConfig);
    } else {
      await runNewApiConfig(currentConfig);
    }
  }

  showConfigSaved('~/.config/cc-launcher/config.json');
}
