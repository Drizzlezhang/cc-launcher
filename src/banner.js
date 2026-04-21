import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取版本号
function getVersion() {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '1.1.0';
  }
}

/**
 * 显示主启动画面
 */
export function showBanner() {
  const version = getVersion();
  console.log();
  console.log(chalk.cyan('   ██████╗ ██████╗ ██████╗ ██╗     ██╗  ██╗██╗   ██╗'));
  console.log(chalk.cyan('  ██╔════╝██╔═══██╗██╔══██╗██║     ██║ ██╔╝██║   ██║'));
  console.log(chalk.cyan('  ██║     ██║   ██║██║  ██║██║     █████╔╝ ██║   ██║'));
  console.log(chalk.cyan('  ██║     ██║   ██║██║  ██║██║     ██╔═██╗ ██║   ██║'));
  console.log(chalk.cyan('  ╚██████╗╚██████╔╝██████╔╝███████╗██║  ██╗╚██████╔╝'));
  console.log(chalk.cyan('   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝ '));
  console.log();
  console.log(chalk.cyan.bold('  ██████╗ ██╗  ██╗███████╗███╗   ██╗ ██████╗███████╗'));
  console.log(chalk.cyan.bold(' ██╔═══██╗██║  ██║██╔════╝████╗  ██║██╔════╝██╔════╝'));
  console.log(chalk.cyan.bold(' ██║   ██║███████║█████╗  ██╔██╗ ██║██║     █████╗  '));
  console.log(chalk.cyan.bold(' ██║   ██║██╔══██║██╔══╝  ██║╚██╗██║██║     ██╔══╝  '));
  console.log(chalk.cyan.bold(' ╚██████╔╝██║  ██║███████╗██║ ╚████║╚██████╗███████╗'));
  console.log(chalk.gray('  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝'));
  console.log();
  console.log(chalk.magenta(`  v${version}`) + chalk.gray('  |  ') + chalk.white('DrizzleZhang'));
  console.log();
}

/**
 * 显示配置向导标题
 */
export function showConfigBanner() {
  console.log();
  console.log(chalk.cyan.bold('  ⚙️  Configuration Wizard'));
  console.log(chalk.gray('  ─────────────────────────'));
  console.log();
}

/**
 * 显示启动信息
 */
export function showLaunchInfo(channel, config) {
  console.log();
  console.log(chalk.cyan.bold('  📋 Configuration Summary'));
  console.log(chalk.gray('  ─────────────────────────'));
  console.log();

  if (channel === 'vertex') {
    console.log(chalk.white('  🌐 Channel:   ') + chalk.green('Google Vertex AI'));
    console.log(chalk.white('  📊 Project:   ') + chalk.green(config.projectId));
    console.log(chalk.white('  🌍 Region:    ') + chalk.green(config.region));
    console.log(chalk.white('  🤖 Model:     ') + chalk.green(config.vertexModel));
  } else {
    console.log(chalk.white('  🌐 Channel:   ') + chalk.green('NewAPI'));
    console.log(chalk.white('  🔗 Endpoint:  ') + chalk.green(config.baseurl));
    console.log(chalk.white('  🤖 Model:     ') + chalk.green(config.selectedModel));
  }
  console.log();
}

/**
 * 显示状态信息
 */
export function showStatus(message, type = 'info') {
  const icons = {
    info: chalk.blue('ℹ️'),
    success: chalk.green('✅'),
    warning: chalk.yellow('⚠️'),
    error: chalk.red('❌'),
    loading: chalk.cyan('🔍'),
    saving: chalk.magenta('💾'),
    launching: chalk.green('🚀'),
  };
  console.log(`  ${icons[type] || icons.info} ${message}`);
}

/**
 * 显示分隔线
 */
export function showDivider() {
  console.log(chalk.gray('  ─────────────────────────'));
}

/**
 * 显示成功消息
 */
export function showSuccess(message) {
  console.log();
  console.log(chalk.green(`  ✅ ${message}`));
  console.log();
}

/**
 * 显示错误消息
 */
export function showError(message) {
  console.log();
  console.log(chalk.red(`  ❌ ${message}`));
  console.log();
}

/**
 * 显示警告消息
 */
export function showWarning(message) {
  console.log();
  console.log(chalk.yellow(`  ⚠️  ${message}`));
  console.log();
}

/**
 * 显示配置保存成功
 */
export function showConfigSaved(configPath) {
  console.log();
  console.log(chalk.green('  🎉 Configuration saved successfully!'));
  console.log(chalk.gray(`  📁 ${configPath}`));
  console.log();
}
