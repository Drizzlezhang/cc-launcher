#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { runConfigFlow } from './config-flow.js';
import { launchClaude } from './launcher.js';

program
  .name('cc-launcher')
  .description('Manage NewAPI config and launch Claude Code CLI')
  .version('1.0.0')
  .option('-c, --config', 'Run interactive configuration')
  .option('--clear', 'Clear saved configuration')
  .action(async (options) => {
    console.log();
    console.log(chalk.cyan.bold('  cc-launcher'));
    console.log(chalk.gray('  NewAPI Manager for Claude Code'));
    console.log();

    if (options.clear) {
      const { clearConfig } = await import('./config.js');
      clearConfig();
      console.log(chalk.green('Configuration cleared.'));
      process.exit(0);
    }

    if (options.config) {
      await runConfigFlow();
    } else {
      await launchClaude();
    }
  });

program.parse();
