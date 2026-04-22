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
export function showLaunchInfo(mode, channel, config) {
  console.log();
  console.log(chalk.cyan.bold('  📋 Configuration Summary'));
  console.log(chalk.gray('  ─────────────────────────'));
  console.log();

  // 显示模式
  const modeDisplay = mode === 'work' ? chalk.yellow('Work') : chalk.blue('Personal');
  console.log(chalk.white('  👤 Mode:      ') + modeDisplay);

  if (channel === 'vertex') {
    console.log(chalk.white('  🌐 Channel:   ') + chalk.green('Vertex AI (Gemini)'));
    console.log(chalk.white('  📊 Project:   ') + chalk.green(config.projectId));
    console.log(chalk.white('  🔗 Proxy:     ') + chalk.green(config.proxyUrl));
    console.log(chalk.white('  🤖 Model:     ') + chalk.green(config.vertexModel));
  } else if (channel === 'kimi') {
    console.log(chalk.white('  🌐 Channel:   ') + chalk.green('Kimi Coding Plan'));
    console.log(chalk.white('  🔗 Endpoint:  ') + chalk.green('https://api.kimi.com/coding/'));
    console.log(chalk.white('  🤖 Model:     ') + chalk.green(config.selectedModel));
  } else if (channel === 'coco') {
    console.log(chalk.white('  🌐 Channel:   ') + chalk.green('coco (Bytedance)'));
    console.log(chalk.white('  🔀 Route:     ') + chalk.green('via coco sidecar proxy'));
  } else if (channel === 'codin') {
    console.log(chalk.white('  🌐 Channel:   ') + chalk.green('codin (Bytedance)'));
    console.log(chalk.white('  🔀 Route:     ') + chalk.green('via codin sidecar proxy'));
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

/**
 * 掩码敏感信息
 */
function maskSensitive(value, visibleChars = 4) {
  if (!value) return chalk.gray('(not set)');
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }
  return value.slice(0, visibleChars) + '****' + value.slice(-visibleChars);
}

/**
 * 显示当前配置状态
 */
export function showConfigStatus(config) {
  console.log();
  console.log(chalk.cyan.bold('  📋 Current Configuration'));
  console.log(chalk.gray('  ─────────────────────────'));
  console.log();

  const modeDisplay = config.mode === 'work' ? chalk.yellow('Work') : chalk.blue('Personal');
  console.log(chalk.white('  👤 Mode:      ') + modeDisplay);

  if (config.mode === 'work') {
    const channelDisplay = {
      'newapi': 'NewAPI',
      'coco': 'coco (Bytedance)',
      'codin': 'codin (Bytedance)',
    };
    const channel = config.channel || 'newapi';
    console.log(chalk.white('  🌐 Channel:   ') + chalk.green(channelDisplay[channel] || channel));

    if (channel === 'coco') {
      console.log(chalk.white('  🔀 Route:     ') + chalk.green('via coco sidecar proxy'));
    } else if (channel === 'codin') {
      console.log(chalk.white('  🔀 Route:     ') + chalk.green('via codin sidecar proxy'));
    } else {
      console.log(chalk.white('  🔗 Endpoint:  ') + chalk.green(config.baseurl || chalk.gray('(not set)')));
      console.log(chalk.white('  🔑 API Key:   ') + maskSensitive(config.apikey));
      console.log(chalk.white('  🤖 Model:     ') + chalk.green(config.selectedModel || chalk.gray('(not set)')));
    }
  } else {
    const channelDisplay = {
      'newapi': 'NewAPI',
      'kimi': 'Kimi Coding Plan',
      'vertex': 'Vertex AI (Gemini)',
      'coco': 'coco (Bytedance)',
      'codin': 'codin (Bytedance)',
    };
    console.log(chalk.white('  🌐 Channel:   ') + chalk.green(channelDisplay[config.channel] || config.channel));

    if (config.channel === 'vertex') {
      console.log(chalk.white('  📊 Project:   ') + chalk.green(config.projectId || chalk.gray('(not set)')));
      console.log(chalk.white('  🔗 Proxy:     ') + chalk.green(config.proxyUrl || chalk.gray('(not set)')));
      console.log(chalk.white('  🤖 Model:     ') + chalk.green(config.vertexModel || chalk.gray('(not set)')));
    } else if (config.channel === 'kimi') {
      console.log(chalk.white('  🔑 API Key:   ') + maskSensitive(config.kimiApikey));
      console.log(chalk.white('  🤖 Model:     ') + chalk.green(config.selectedModel || chalk.gray('(not set)')));
    } else {
      console.log(chalk.white('  🔗 Endpoint:  ') + chalk.green(config.baseurl || chalk.gray('(not set)')));
      console.log(chalk.white('  🔑 API Key:   ') + maskSensitive(config.apikey));
      console.log(chalk.white('  🤖 Model:     ') + chalk.green(config.selectedModel || chalk.gray('(not set)')));
    }
  }

  console.log();
}
