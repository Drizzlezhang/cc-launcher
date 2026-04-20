import { execa } from 'execa';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';
import { getConfig, hasValidConfig } from './config.js';
import { runConfigFlow } from './config-flow.js';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.drizzle.json');

function readSettings() {
  if (!existsSync(SETTINGS_PATH)) {
    return { env: {}, permissions: { allow: [] } };
  }
  try {
    const content = readFileSync(SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(chalk.yellow('Warning: Failed to parse settings file, creating new one'));
    return { env: {}, permissions: { allow: [] } };
  }
}

function writeSettings(settings) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

function updateSettingsEnv(settings, { baseurl, apikey, selectedModel }) {
  if (!settings.env) {
    settings.env = {};
  }
  settings.env.ANTHROPIC_BASE_URL = baseurl;
  settings.env.ANTHROPIC_AUTH_TOKEN = apikey;
  settings.env.ANTHROPIC_MODEL = selectedModel;
  return settings;
}

export async function launchClaude() {
  // Check if config exists
  if (!hasValidConfig()) {
    console.log(chalk.yellow('No valid configuration found. Let\'s set it up first.'));
    console.log();
    await runConfigFlow();
    // After config, read the new config
    if (!hasValidConfig()) {
      console.error(chalk.red('Configuration failed. Exiting.'));
      process.exit(1);
    }
  }

  const config = getConfig();

  // Update settings.drizzle.json
  console.log(chalk.gray('Updating Claude settings...'));
  const settings = readSettings();
  updateSettingsEnv(settings, config);
  writeSettings(settings);

  console.log(chalk.green('Settings updated successfully!'));
  console.log(chalk.gray(`  Base URL: ${config.baseurl}`));
  console.log(chalk.gray(`  Model: ${config.selectedModel}`));
  console.log();

  // Launch claude
  console.log(chalk.cyan('Launching Claude Code...'));
  console.log();

  try {
    await execa('claude', ['--settings', SETTINGS_PATH], {
      stdio: 'inherit',
      preferLocal: false,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(chalk.red('Error: "claude" command not found.'));
      console.error(chalk.yellow('Please make sure Claude Code CLI is installed globally.'));
      console.error(chalk.gray('Install: npm install -g @anthropic-ai/claude-code'));
      process.exit(1);
    }
    // If the process exited with a code, that's normal (user quit)
    if (error.exitCode !== undefined && error.exitCode !== 0) {
      console.error(chalk.red(`Claude exited with code ${error.exitCode}`));
    }
  }
}
