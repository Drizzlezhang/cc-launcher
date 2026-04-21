#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { runConfigFlow } from './config-flow.js';
import { launchClaude } from './launcher.js';
import { showBanner, showConfigStatus } from './banner.js';
import { getConfig, setMode, getMode } from './config.js';
import { checkForUpdate, performUpdate } from './update.js';

program
  .name('cc-launcher')
  .description('Manage API config and launch Claude Code CLI (supports NewAPI, Kimi, and Google Vertex AI)')
  .version('1.3.1')
  .option('-c, --config', 'Run interactive configuration')
  .option('-s, --status', 'Show current configuration status')
  .option('-m, --mode <mode>', 'Switch mode (work/personal)')
  .option('-u, --update', 'Check and update to latest version')
  .option('--clear', 'Clear saved configuration')
  .action(async (options) => {
    showBanner();

    if (options.clear) {
      const { clearConfig } = await import('./config.js');
      clearConfig();
      console.log(chalk.green('  ✅ Configuration cleared.'));
      console.log();
      process.exit(0);
    }

    if (options.status) {
      const config = getConfig();
      showConfigStatus(config);
      process.exit(0);
    }

    if (options.mode) {
      const mode = options.mode.toLowerCase();
      if (mode !== 'work' && mode !== 'personal') {
        console.log(chalk.red('  ❌ Invalid mode. Use "work" or "personal".'));
        console.log();
        process.exit(1);
      }
      setMode(mode);
      console.log(chalk.green(`  ✅ Mode switched to ${chalk.bold(mode)}.`));
      console.log();
      process.exit(0);
    }

    if (options.update) {
      const updateInfo = await checkForUpdate();
      if (updateInfo.hasUpdate) {
        console.log();
        console.log(chalk.yellow(`  📦 New version available: ${chalk.bold(`v${updateInfo.latestVersion}`)} (current: v${updateInfo.currentVersion})`));
        console.log();
        const success = await performUpdate(updateInfo.latestVersion);
        process.exit(success ? 0 : 1);
      } else {
        console.log();
        process.exit(0);
      }
    }

    if (options.config) {
      await runConfigFlow();
    } else {
      await launchClaude();
    }
  });

program.parse();
