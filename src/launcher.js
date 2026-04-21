import { execa } from 'execa';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';
import { getConfig, hasValidConfig, getChannel } from './config.js';
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

function updateSettingsForNewApi(settings, { baseurl, apikey, selectedModel }) {
  if (!settings.env) {
    settings.env = {};
  }
  // Clear Vertex settings if any
  delete settings.env.CLAUDE_CODE_USE_VERTEX;
  delete settings.env.CLOUD_ML_REGION;
  delete settings.env.ANTHROPIC_VERTEX_PROJECT_ID;
  delete settings.env.GOOGLE_APPLICATION_CREDENTIALS;

  // Set NewAPI settings
  settings.env.ANTHROPIC_BASE_URL = baseurl;
  settings.env.ANTHROPIC_AUTH_TOKEN = apikey;
  settings.env.ANTHROPIC_MODEL = selectedModel;
  return settings;
}

function updateSettingsForVertex(settings, { projectId, region, vertexModel, serviceAccountKeyPath }) {
  if (!settings.env) {
    settings.env = {};
  }
  // Clear NewAPI settings if any
  delete settings.env.ANTHROPIC_BASE_URL;
  delete settings.env.ANTHROPIC_AUTH_TOKEN;

  // Set Vertex AI settings
  settings.env.CLAUDE_CODE_USE_VERTEX = '1';
  settings.env.CLOUD_ML_REGION = region || 'global';
  settings.env.ANTHROPIC_VERTEX_PROJECT_ID = projectId;
  settings.env.ANTHROPIC_MODEL = vertexModel;

  // Optional: Service Account Key
  if (serviceAccountKeyPath) {
    settings.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountKeyPath;
  }

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
  const channel = getChannel();

  // Update settings.drizzle.json
  console.log(chalk.gray('Updating Claude settings...'));
  const settings = readSettings();

  if (channel === 'vertex') {
    updateSettingsForVertex(settings, config);
    console.log(chalk.green('Settings updated successfully!'));
    console.log(chalk.gray(`  Channel: Google Vertex AI`));
    console.log(chalk.gray(`  Project: ${config.projectId}`));
    console.log(chalk.gray(`  Region: ${config.region}`));
    console.log(chalk.gray(`  Model: ${config.vertexModel}`));
  } else {
    updateSettingsForNewApi(settings, config);
    console.log(chalk.green('Settings updated successfully!'));
    console.log(chalk.gray(`  Channel: NewAPI`));
    console.log(chalk.gray(`  Base URL: ${config.baseurl}`));
    console.log(chalk.gray(`  Model: ${config.selectedModel}`));
  }

  writeSettings(settings);
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
