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
import {
  checkAndShowCocoStatus,
  checkAndShowCodinStatus,
  getCocoModels,
  getCodinModels,
} from './tools.js';

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

  // 先选择渠道
  const { channel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'channel',
      message: '🌐 Choose your provider:',
      choices: [
        { name: `NewAPI ${chalk.gray('(OpenAI-compatible)')}`, value: 'newapi' },
        { name: `coco ${chalk.gray('(Bytedance)')}`, value: 'coco' },
        { name: `codin ${chalk.gray('(Bytedance)')}`, value: 'codin' },
        { name: BACK_OPTION, value: 'back' },
      ],
      default: workConfig.channel || 'newapi',
    },
  ]);

  if (channel === 'back') return false;

  console.log();

  // 根据渠道调用不同的配置函数
  if (channel === 'coco') {
    return await runCocoConfig();
  } else if (channel === 'codin') {
    return await runCodinConfig();
  }

  // NewAPI 渠道（原有逻辑）
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
    channel: 'newapi',
    baseurl,
    apikey,
    selectedModel,
  });

  return true;
}

async function runCocoConfig() {
  const workConfig = getWorkConfig();

  console.log();

  // 检查安装和登录状态
  const status = await checkAndShowCocoStatus();
  if (!status.canProceed) {
    return false;
  }

  console.log();

  // 获取并选择模型（动态优先，失败可手动输入）
  const models = getCocoModels();

  const choices = [
    ...models,
    chalk.gray('✏️  Enter model manually'),
    BACK_OPTION,
  ];

  const { cocoModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'cocoModel',
      message: '🤖 Choose model:',
      choices,
      default: workConfig.cocoModel && models.includes(workConfig.cocoModel)
        ? workConfig.cocoModel
        : models[0],
    },
  ]);

  if (cocoModel === BACK_OPTION) return false;

  let finalCocoModel = cocoModel;
  if (cocoModel === chalk.gray('✏️  Enter model manually')) {
    const { manualModel } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualModel',
        message: '🤖 Enter coco model name:',
        default: workConfig.cocoModel || '',
        validate: (input) => input.trim() ? true : 'Model is required',
      },
    ]);
    finalCocoModel = manualModel.trim();
  }

  setConfig({
    channel: 'coco',
    cocoModel: finalCocoModel,
  });

  return true;
}

async function runCodinConfig() {
  const workConfig = getWorkConfig();

  console.log();

  // 检查安装和登录状态
  const status = await checkAndShowCodinStatus();
  if (!status.canProceed) {
    return false;
  }

  console.log();

  // 选择模型（动态优先，失败可手动输入）
  const codinModels = getCodinModels();
  const MANUAL_OPTION = '__manual__';

  const { codinModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'codinModel',
      message: '🤖 Choose model:',
      choices: [
        ...codinModels.map((m) => ({
          name: m.name,
          value: m.id,
        })),
        { name: chalk.gray('✏️  Enter model manually'), value: MANUAL_OPTION },
        BACK_OPTION,
      ],
      default: workConfig.codinModel || codinModels[0]?.id || 'GPT-5',
    },
  ]);

  if (codinModel === BACK_OPTION) return false;

  let finalCodinModel = codinModel;
  if (codinModel === MANUAL_OPTION) {
    const { manualModel } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualModel',
        message: '🤖 Enter codin model name:',
        default: workConfig.codinModel || '',
        validate: (input) => input.trim() ? true : 'Model is required',
      },
    ]);
    finalCodinModel = manualModel.trim();
  }

  const { codinBaseurl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'codinBaseurl',
      message: '🔗 Enter codin endpoint URL:',
      default: workConfig.codinBaseurl || 'https://aime.bytedance.net/api/agents/v2/llmproxy/app',
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

  const { codinToken } = await inquirer.prompt([
    {
      type: 'password',
      name: 'codinToken',
      message: '🔑 Enter codin auth token:',
      default: workConfig.codinToken || '',
      validate: (input) => input.trim() ? true : 'Token is required',
    },
  ]);

  setConfig({
    channel: 'codin',
    codinModel: finalCodinModel,
    codinBaseurl,
    codinToken,
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

export async function runSessionConfigFlow() {
  showConfigBanner();

  const workConfig = getWorkConfig();
  const personalConfig = getPersonalConfig();

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: '👤 Select mode for this session:',
      choices: [
        { name: `Personal ${chalk.gray('(session only)')}`, value: 'personal' },
        { name: `Work ${chalk.gray('(session only)')}`, value: 'work' },
      ],
      default: getMode(),
    },
  ]);

  setConfig({ mode });

  if (mode === 'work') {
    const { channel } = await inquirer.prompt([
      {
        type: 'list',
        name: 'channel',
        message: '🌐 Choose your provider:',
        choices: [
          { name: `NewAPI ${chalk.gray('(OpenAI-compatible)')}`, value: 'newapi' },
          { name: `coco ${chalk.gray('(Bytedance)')}`, value: 'coco' },
          { name: `codin ${chalk.gray('(Bytedance)')}`, value: 'codin' },
        ],
        default: workConfig.channel || 'newapi',
      },
    ]);

    if (channel === 'coco') {
      const status = await checkAndShowCocoStatus();
      if (!status.canProceed) return null;
      setConfig({ mode: 'work', channel: 'coco' });
      return { mode: 'work', channel: 'coco' };
    }

    if (channel === 'codin') {
      const status = await checkAndShowCodinStatus();
      if (!status.canProceed) return null;
      setConfig({ mode: 'work', channel: 'codin' });
      return { mode: 'work', channel: 'codin' };
    }

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
        validate: (input) => (input.trim() ? true : 'API key is required'),
      },
    ]);

    const selectedModel = await fetchAndSelectModel(baseurl, apikey, workConfig.selectedModel || null);
    if (!selectedModel) return null;

    setConfig({
      mode: 'work',
      channel: 'newapi',
      baseurl,
      apikey,
      selectedModel,
    });

    return { mode: 'work', channel: 'newapi', baseurl, apikey, selectedModel };
  }

  const { channel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'channel',
      message: '🌐 Choose your API provider:',
      choices: [
        { name: `NewAPI ${chalk.gray('(OpenAI-compatible)')}`, value: 'newapi' },
        { name: `Kimi Coding Plan`, value: 'kimi' },
        { name: `Google Vertex AI ${chalk.gray('(GCP)')}`, value: 'vertex' },
      ],
      default: personalConfig.channel || 'newapi',
    },
  ]);

  if (channel === 'vertex') {
    if (!isGcloudInstalled()) {
      showWarning('gcloud CLI is not installed.');
      return null;
    }

    const defaultProjectId = getCurrentProjectId();
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectId',
        message: '📊 Enter GCP Project ID:',
        default: personalConfig.projectId || defaultProjectId || '',
        validate: (input) => input.trim() ? true : 'Project ID is required',
      },
      {
        type: 'list',
        name: 'region',
        message: '🌍 Choose a region:',
        choices: VERTEX_REGIONS.map((r) => ({ name: `${r.name} ${chalk.gray(`(${r.description})`)}`, value: r.id })),
        default: personalConfig.region || 'global',
      },
      {
        type: 'list',
        name: 'vertexModel',
        message: '🤖 Choose Gemini model:',
        choices: VERTEX_MODELS.map((m) => ({ name: `${m.name} ${chalk.gray(`(${m.context}, ${m.description})`)}`, value: m.id })),
        default: personalConfig.vertexModel || 'gemini-3.1-pro-preview',
      },
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
      mode: 'personal',
      channel: 'vertex',
      projectId: answers.projectId,
      region: answers.region,
      vertexModel: answers.vertexModel,
      proxyUrl: answers.proxyUrl,
    });

    return {
      mode: 'personal',
      channel: 'vertex',
      projectId: answers.projectId,
      region: answers.region,
      vertexModel: answers.vertexModel,
      proxyUrl: answers.proxyUrl,
    };
  }

  if (channel === 'kimi') {
    const { kimiApikey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'kimiApikey',
        message: '🔑 Enter Kimi API key:',
        default: personalConfig.kimiApikey || '',
        validate: (input) => (input.trim() ? true : 'API key is required'),
      },
    ]);

    const selectedModel = await fetchAndSelectModel(KIMI_BASE_URL, kimiApikey, personalConfig.selectedModel || null);
    if (!selectedModel) return null;

    setConfig({
      mode: 'personal',
      channel: 'kimi',
      kimiApikey,
      selectedModel,
    });

    return {
      mode: 'personal',
      channel: 'kimi',
      kimiApikey,
      selectedModel,
    };
  }

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
      validate: (input) => (input.trim() ? true : 'API key is required'),
    },
  ]);

  const selectedModel = await fetchAndSelectModel(baseurl, apikey, personalConfig.selectedModel || null);
  if (!selectedModel) return null;

  setConfig({
    mode: 'personal',
    channel: 'newapi',
    baseurl,
    apikey,
    selectedModel,
  });

  return { mode: 'personal', channel: 'newapi', baseurl, apikey, selectedModel };
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
