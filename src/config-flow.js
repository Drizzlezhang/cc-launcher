import inquirer from 'inquirer';
import chalk from 'chalk';
import { getConfig, setConfig } from './config.js';
import { fetchModels } from './api.js';

export async function runConfigFlow() {
  console.log(chalk.cyan.bold('cc-launcher Configuration'));
  console.log(chalk.gray('Configure your NewAPI settings for Claude Code'));
  console.log();

  // Get current config for default values
  const currentConfig = getConfig();

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

  // Prompt for model selection using simple list with filtering
  // Paginate if too many models
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
    baseurl: answers.baseurl,
    apikey: answers.apikey,
    selectedModel: modelAnswer.selectedModel,
  });

  console.log();
  console.log(chalk.green('Configuration saved successfully!'));
  console.log(chalk.gray(`Config file: ~/.config/cc-launcher/config.json`));
}
