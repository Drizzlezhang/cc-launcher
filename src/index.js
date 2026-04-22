#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { launchClaude } from './launcher.js';
import { showBanner } from './banner.js';
import { checkForUpdate, performUpdate } from './update.js';

program
  .name('cc-launcher')
  .description('Launch Claude Code with session-scoped mode/channel/model selection')
  .version('1.3.1')
  .option('-u, --update', 'Check and update to latest version')
  .action(async (options) => {
    showBanner();

    if (options.update) {
      const updateInfo = await checkForUpdate();
      if (updateInfo.hasUpdate) {
        console.log();
        console.log(chalk.yellow(`  📦 New version available: ${chalk.bold(`v${updateInfo.latestVersion}`)} (current: v${updateInfo.currentVersion})`));
        console.log();
        const success = await performUpdate(updateInfo.latestVersion);
        process.exit(success ? 0 : 1);
      }
      console.log();
      process.exit(0);
    }

    await launchClaude();
  });

program.parse();
