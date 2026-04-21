import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  setMode,
  getMode,
  getWorkConfig,
  getPersonalConfig,
  setConfig,
} from './config.js';
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

const BACK_OPTION = chalk.gray('← Back');

async function fetchAndSelectModel(baseurl, apikey, defaultModel) {
  console.log();
  showStatus('Fetching available models...', 'loading');

  let models;
  try {
    models = await fetchModels(baseurl, apikey);
    if (models.length === 0) {
      console.log();
      showWarning('No models found from this endpoint.');
      return null;
    }
    showStatus(`Found ${models.length} models`, 'success');
  } catch (error) {
    console.log();
    showStatus(error.message, 'error');
    return null;
  }

  console.log();

  const pageSize = Math.min(12, models.length);
  const { selectedModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      message: '🤖 Choose your default model:',
      choices: [...models, BACK_OPTION],
      default: defaultModel || models[0],
      pageSize,
    },
  ]);

  return selectedModel === BACK_OPTION ? null : selectedModel;
}

async function runWorkConfig() {
  const workConfig = getWorkConfig();

  const { baseurl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseurl',
      message: '🔗 Enter work API endpoint URL:',
      default: workConfig.baseurl || '',
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
  ]);

  const { apikey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apikey',
      message: '🔑 Enter work API key:',
      default: workConfig.apikey || '',
      validate: (input) => {
        if (!input.trim()) return 'API key is required';
        return true;
      },
    },
  ]);

  const selectedModel = await fetchAndSelectModel(baseurl, apikey, workConfig.selectedModel);
  if (!selectedModel) return false;

  setConfig({
    baseurl,
    apikey,
    selectedModel,
  });

  return true;
}

async function runNewApiConfig() {
  const personalConfig = getPersonalConfig();

  const { baseurl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseurl',
      message: '🔗 Enter API endpoint URL:',
      default: personalConfig.baseurl || '',
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
  ]);

  const { apikey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apikey',
      message: '🔑 Enter your API key:',
      default: personalConfig.apikey || '',
      validate: (input) => {
        if (!input.trim()) return 'API key is required';
        return true;
      },
    },
  ]);

  const selectedModel = await fetchAndSelectModel(baseurl, apikey, personalConfig.selectedModel);
  if (!selectedModel) return false;

  setConfig({
    channel: 'newapi',
    baseurl,
    apikey,
    selectedModel,
  });

  return true;
}

const KIMI_BASE_URL = 'https://api.kimi.com/coding/';

async function runKimiConfig() {
  const personalConfig = getPersonalConfig();

  // 显示已保存的 key 提示
  if (personalConfig.kimiApikey) {
    const maskedKey = personalConfig.kimiApikey.slice(0, 4) + '****' + personalConfig.kimiApikey.slice(-4);
    console.log(chalk.gray(`  Using saved key: ${maskedKey}`));
  }

  const { kimiApikey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'kimiApikey',
      message: '🔑 Enter Kimi API key (press Enter to use saved):',
      default: personalConfig.kimiApikey || '',
      validate: (input) => {
        if (!input.trim()) return 'API key is required';
        return true;
      },
    },
  ]);

  const selectedModel = await fetchAndSelectModel(KIMI_BASE_URL, kimiApikey, personalConfig.selectedModel);
  if (!selectedModel) return false;

  setConfig({
    channel: 'kimi',
    kimiApikey,
    selectedModel,
  });

  return true;
}

async function runVertexConfig() {
  const personalConfig = getPersonalConfig();

  if (!isGcloudInstalled()) {
    console.log();
    showWarning('gcloud CLI is not installed.');
    console.log(chalk.gray('  Install from: https://cloud.google.com/sdk/docs/install'));
    console.log();

    const { continueAnyway } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAnyway',
        message: 'Continue without gcloud CLI?',
        default: false,
      },
    ]);

    if (!continueAnyway) {
      return false;
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

  console.log();

  const defaultProjectId = getCurrentProjectId();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectId',
      message: '📊 Enter GCP Project ID:',
      default: personalConfig.projectId || defaultProjectId || '',
      validate: (input) => {
        if (!input.trim()) return 'Project ID is required';
        return true;
      },
    },
    {
      type: 'list',
      name: 'region',
      message: '🌍 Choose a region:',
      choices: [...VERTEX_REGIONS.map((r) => ({
        name: `${r.name} ${chalk.gray(`(${r.description})`)}`,
        value: r.id,
      })), BACK_OPTION],
      default: personalConfig.region || 'global',
    },
  ]);

  if (answers.region === BACK_OPTION) return false;

  const { vertexModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'vertexModel',
      message: '🤖 Choose Gemini model:',
      choices: [...VERTEX_MODELS.map((m) => ({
        name: `${m.name} ${chalk.gray(`(${m.context}, ${m.description})`)}`,
        value: m.id,
      })), BACK_OPTION],
      default: personalConfig.vertexModel || 'gemini-3.1-pro-preview',
    },
  ]);

  if (vertexModel === BACK_OPTION) return false;

  const { proxyUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'proxyUrl',
      message: '🔗 Proxy URL (e.g. http://localhost:8082):',
      default: personalConfig.proxyUrl || 'http://localhost:8082',
      validate: (input) => {
        if (!input.trim()) return 'Proxy URL is required';
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
  ]);

  setConfig({
    channel: 'vertex',
    projectId: answers.projectId,
    region: answers.region,
    vertexModel,
    proxyUrl,
  });

  return true;
}

export async function runConfigFlow() {
  showConfigBanner();

  let currentStep = 'mode';

  while (true) {
    if (currentStep === 'mode') {
      const { mode } = await inquirer.prompt([
        {
          type: 'list',
          name: 'mode',
          message: '👤 Select mode:',
          choices: [
            { name: `Personal ${chalk.gray('(configure yourself)')}`, value: 'personal' },
            { name: `Work ${chalk.gray('(company environment)')}`, value: 'work' },
            { name: BACK_OPTION, value: 'exit' },
          ],
          default: getMode(),
        },
      ]);

      if (mode === 'exit') {
        console.log();
        return;
      }

      setMode(mode);
      console.log();

      if (mode === 'work') {
        const success = await runWorkConfig();
        if (success) {
          showConfigSaved('~/.config/cc-launcher/config.json');
          return;
        }
        // 失败则回到模式选择
        currentStep = 'mode';
        console.log();
      } else {
        currentStep = 'channel';
      }
    }

    if (currentStep === 'channel') {
      const personalConfig = getPersonalConfig();

      const { channel } = await inquirer.prompt([
        {
          type: 'list',
          name: 'channel',
          message: '🌐 Choose your API provider:',
          choices: [
            { name: `NewAPI ${chalk.gray('(OpenAI-compatible)')}`, value: 'newapi' },
            { name: `Kimi Coding Plan`, value: 'kimi' },
            { name: `Google Vertex AI ${chalk.gray('(GCP)')}`, value: 'vertex' },
            { name: BACK_OPTION, value: 'back' },
          ],
          default: personalConfig.channel || 'newapi',
        },
      ]);

      if (channel === 'back') {
        currentStep = 'mode';
        console.log();
        continue;
      }

      console.log();

      let success;
      if (channel === 'vertex') {
        success = await runVertexConfig();
      } else if (channel === 'kimi') {
        success = await runKimiConfig();
      } else {
        success = await runNewApiConfig();
      }

      if (success) {
        showConfigSaved('~/.config/cc-launcher/config.json');
        return;
      }

      // 失败则回到渠道选择
      currentStep = 'channel';
      console.log();
    }
  }
}
