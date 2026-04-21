#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { runConfigFlow } from './config-flow.js';
import { launchClaude } from './launcher.js';
import { showBanner } from './banner.js';

program
  .name('cc-launcher')
  .description('Manage API config and launch Claude Code CLI (supports NewAPI and Google Vertex AI)')
  .version('1.1.0')
  .option('-c, --config', 'Run interactive configuration')
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

    if (options.config) {
      await runConfigFlow();
    } else {
      await launchClaude();
    }
  });

program.parse();
