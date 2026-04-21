import inquirer from 'inquirer';
import chalk from 'chalk';
import { getConfig, setConfig } from './config.js';
import { fetchModels } from './api.js';
import {
  VERTEX_MODELS,
  VERTEX_REGIONS,
  hasAdcConfigured,
  getCurrentProjectId,
  printAuthGuide,
  isGcloudInstalled,
} from './vertex.js';

async function runNewApiConfig(currentConfig) {
  // Prompt for baseurl and apikey
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseurl',
      message: 'NewAPI Base URL:',
      default: currentConfig.baseurl || '',
      validate: (input) => {
        if (!input.trim()) return 'Base URL is required';
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
      message: 'API Key:',
      default: currentConfig.apikey || '',
      validate: (input) => {
        if (!input.trim()) return 'API Key is required';
        return true;
      },
    },
  ]);

  console.log();
  console.log(chalk.gray('Fetching available models...'));

  // Fetch models
  let models;
  try {
    models = await fetchModels(answers.baseurl, answers.apikey);
    if (models.length === 0) {
      console.error(chalk.red('No models found.'));
      process.exit(1);
    }
    console.log(chalk.green(`Found ${models.length} models`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }

  // Prompt for model selection
  const pageSize = Math.min(15, models.length);
  const modelAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      message: 'Select default model:',
      choices: models,
      default: currentConfig.selectedModel || models[0],
      pageSize,
    },
  ]);

  // Save config
  setConfig({
    channel: 'newapi',
    baseurl: answers.baseurl,
    apikey: answers.apikey,
    selectedModel: modelAnswer.selectedModel,
  });
}

async function runVertexConfig(currentConfig) {
  // Check gcloud installation
  if (!isGcloudInstalled()) {
    console.log();
    console.log(chalk.yellow('Warning: gcloud CLI is not installed.'));
    console.log(chalk.gray('Please install Google Cloud SDK first:'));
    console.log(chalk.cyan('  https://cloud.google.com/sdk/docs/install'));
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

  // Check ADC status
  const adcConfigured = hasAdcConfigured();
  if (!adcConfigured) {
    console.log();
    console.log(chalk.yellow('Warning: Application Default Credentials (ADC) not configured.'));
    printAuthGuide();

    const { setupNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setupNow',
        message: 'Would you like to run "gcloud auth application-default login" now?',
        default: true,
      },
    ]);

    if (setupNow) {
      console.log();
      console.log(chalk.cyan('Running gcloud auth application-default login...'));
      console.log(chalk.gray('Please complete the authentication in your browser.'));
      console.log();

      try {
        const { execSync } = await import('child_process');
        execSync('gcloud auth application-default login', { stdio: 'inherit' });
        console.log(chalk.green('Authentication successful!'));
      } catch (error) {
        console.log(chalk.red('Authentication failed. You can set up credentials later.'));
      }
    }
  }

  // Get default project ID
  const defaultProjectId = getCurrentProjectId();

  // Prompt for Vertex configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectId',
      message: 'GCP Project ID:',
      default: currentConfig.projectId || defaultProjectId || '',
      validate: (input) => {
        if (!input.trim()) return 'Project ID is required';
        return true;
      },
    },
    {
      type: 'list',
      name: 'region',
      message: 'Select Region:',
      choices: VERTEX_REGIONS.map((r) => ({
        name: `${r.name} - ${r.description}`,
        value: r.id,
      })),
      default: currentConfig.region || 'global',
    },
    {
      type: 'list',
      name: 'vertexModel',
      message: 'Select Claude Model:',
      choices: VERTEX_MODELS.map((m) => ({
        name: `${m.name} (${m.context} context)`,
        value: m.id,
      })),
      default: currentConfig.vertexModel || 'claude-sonnet-4-6',
    },
    {
      type: 'input',
      name: 'serviceAccountKeyPath',
      message: 'Service Account Key path (optional, press Enter to use ADC):',
      default: currentConfig.serviceAccountKeyPath || '',
    },
  ]);

  // Save config
  setConfig({
    channel: 'vertex',
    projectId: answers.projectId,
    region: answers.region,
    vertexModel: answers.vertexModel,
    serviceAccountKeyPath: answers.serviceAccountKeyPath || undefined,
  });
}

export async function runConfigFlow() {
  console.log(chalk.cyan.bold('cc-launcher Configuration'));
  console.log(chalk.gray('Configure your API settings for Claude Code'));
  console.log();

  // Get current config for default values
  const currentConfig = getConfig();

  // First, ask for channel selection
  const channelAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'channel',
      message: 'Select API Channel:',
      choices: [
        { name: 'NewAPI (OpenAI-compatible API)', value: 'newapi' },
        { name: 'Google Vertex AI', value: 'vertex' },
      ],
      default: currentConfig.channel || 'newapi',
    },
  ]);

  console.log();

  // Run appropriate configuration flow
  if (channelAnswer.channel === 'vertex') {
    await runVertexConfig(currentConfig);
  } else {
    await runNewApiConfig(currentConfig);
  }

  console.log();
  console.log(chalk.green('Configuration saved successfully!'));
  console.log(chalk.gray('Config file: ~/.config/cc-launcher/config.json'));

  if (channelAnswer.channel === 'vertex') {
    console.log();
    console.log(chalk.yellow('Note: Make sure you have access to Claude models in Vertex AI Model Garden.'));
    console.log(chalk.gray('Visit: https://console.cloud.google.com/vertex-ai/model-garden'));
  }
}
