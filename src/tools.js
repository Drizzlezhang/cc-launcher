import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';
import { showStatus, showWarning } from './banner.js';

function runCommandOutput(command, timeout = 10000) {
  try {
    const safeCommand = /^(coco|codin)\b/.test(command.trim())
      ? `printf 'n\\n' | ${command}`
      : command;
    return execSync(`${safeCommand} 2>&1`, { encoding: 'utf-8', timeout, shell: true });
  } catch (error) {
    const stdout = error?.stdout?.toString?.() || '';
    const stderr = error?.stderr?.toString?.() || '';
    const merged = `${stdout}${stderr}`.trim();
    return merged || null;
  }
}

function parseModelLines(output) {
  if (!output) return [];

  const ignoredPatterns = [
    /deprecationwarning/i,
    /usage:/i,
    /available commands/i,
    /help/i,
    /model.*current/i,
    /当前使用的模型/i,
  ];

  const raw = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !ignoredPatterns.some((p) => p.test(line)));

  const extracted = [];
  for (const line of raw) {
    const cleaned = line
      .replace(/^[-*•]\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/^\|\s*/, '')
      .replace(/\s*\|.*$/, '')
      .trim();

    if (!cleaned) continue;

    // 常见模型名特征（尽量保守，避免把解释文本当模型）
    if (/[A-Za-z]/.test(cleaned) && /\d|gpt|claude|kimi|glm|doubao|sonnet|opus|haiku/i.test(cleaned)) {
      extracted.push(cleaned);
    }
  }

  return [...new Set(extracted)];
}

function getModelsFromCommandCandidates(commands) {
  for (const cmd of commands) {
    const output = runCommandOutput(cmd, 15000);
    const models = parseModelLines(output);
    if (models.length > 0) {
      return models;
    }
  }
  return [];
}

/**
 * 检查 coco 是否已安装
 */
export function checkCocoInstalled() {
  try {
    const output = execSync("printf 'n\\n' | coco --version 2>&1", { encoding: 'utf-8', timeout: 10000, shell: true }).trim();
    const match = output.match(/coco version (\S+)/);
    return {
      installed: true,
      version: match ? match[1] : output.split('\n')[0],
    };
  } catch (error) {
    const raw = `${error?.stdout?.toString?.() || ''}${error?.stderr?.toString?.() || ''}`.trim();
    const match = raw.match(/coco version (\S+)/);
    if (match || raw.includes('coco version')) {
      return {
        installed: true,
        version: match ? match[1] : raw.split('\n')[0],
      };
    }
    return { installed: false, version: null };
  }
}

/**
 * 检查 codin 是否已安装
 */
export function checkCodinInstalled() {
  try {
    const output = execSync("printf 'n\\n' | codin --version 2>&1", { encoding: 'utf-8', timeout: 10000, shell: true }).trim();
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return {
      installed: true,
      version: match ? match[1] : output.split('\n')[0],
    };
  } catch {
    return { installed: false, version: null };
  }
}

/**
 * 检查 coco 登录状态
 * 通过检查 ~/.trae/traecli.yaml 配置文件
 */
export function checkCocoLogin() {
  const configPath = join(homedir(), '.trae', 'traecli.yaml');

  if (!existsSync(configPath)) {
    // 尝试旧路径
    const oldPath = join(homedir(), '.coco', 'config.json');
    if (!existsSync(oldPath)) {
      return { loggedIn: false, user: null };
    }
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    // 检查是否有有效的模型配置
    if (content.includes('model:') && content.includes('name:')) {
      return { loggedIn: true, user: 'configured' };
    }
    return { loggedIn: false, user: null };
  } catch {
    return { loggedIn: false, user: null };
  }
}

/**
 * 检查 codin 登录状态
 */
export function checkCodinLogin() {
  try {
    const output = execSync("printf 'n\n' | codin login --check 2>&1", { encoding: 'utf-8', timeout: 10000, shell: true });

    // 解析输出获取用户信息
    const userMatch = output.match(/Logged in as:\s*(.+)/);
    const emailMatch = output.match(/Email:\s*(.+)/);

    if (output.includes('Logged in')) {
      return {
        loggedIn: true,
        user: userMatch ? userMatch[1].trim() : 'unknown',
        email: emailMatch ? emailMatch[1].trim() : null,
      };
    }
    return { loggedIn: false, user: null };
  } catch {
    return { loggedIn: false, user: null };
  }
}

/**
 * 从 coco 配置获取模型列表
 */
export function getCocoModels() {
  // 优先尝试通过 CLI 动态获取
  const cliModels = getModelsFromCommandCandidates([
    'coco model list',
    'coco /model',
    'coco --print "/model"',
  ]);
  if (cliModels.length > 0) {
    return cliModels;
  }

  // 回退到本地配置解析
  const configPath = join(homedir(), '.trae', 'traecli.yaml');

  try {
    if (!existsSync(configPath)) {
      return [];
    }

    const content = readFileSync(configPath, 'utf-8');
    const models = [];

    // 解析 YAML 格式的模型列表
    const lines = content.split('\n');
    let inModelsSection = false;

    for (const line of lines) {
      if (line.includes('models:')) {
        inModelsSection = true;
        continue;
      }

      if (inModelsSection && line.includes('name:')) {
        const match = line.match(/name:\s*(.+)/);
        if (match) {
          models.push(match[1].trim());
        }
      }

      // 遇到新的顶级键，退出 models 部分
      if (inModelsSection && line && !line.startsWith(' ') && !line.startsWith('\t') && !line.includes('models:')) {
        break;
      }
    }

    return models.length > 0 ? [...new Set(models)] : ['GLM-5.1'];
  } catch {
    return ['GLM-5.1'];
  }
}

/**
 * codin 支持的模型列表
 */
export const CODIN_MODELS = [
  { id: 'GPT-5', name: 'GPT-5' },
  { id: 'Kimi K2', name: 'Kimi K2' },
  { id: 'GLM-4.6', name: 'GLM-4.6' },
  { id: 'doubao-seed-1-6', name: 'Doubao Seed 1.6' },
];

export function getCodinModels() {
  const cliModels = getModelsFromCommandCandidates([
    'codin -p "/model" --timeout 20',
    'codin --model help',
  ]);

  if (cliModels.length > 0) {
    return cliModels.map((m) => ({ id: m, name: m }));
  }

  return CODIN_MODELS;
}

/**
 * 显示 coco/codin 安装和登录检查结果
 */
export async function checkAndShowCocoStatus() {
  // 安装检查
  const install = checkCocoInstalled();
  if (!install.installed) {
    showWarning('coco is not installed.');
    console.log(chalk.gray('  Please install coco first.'));
    return { canProceed: false };
  }

  showStatus(`coco v${install.version} found`, 'success');

  // 登录检查
  const login = checkCocoLogin();
  if (!login.loggedIn) {
    showWarning('coco is not logged in.');
    console.log(chalk.gray('  Run: coco'));
    console.log(chalk.gray('  Then complete the login process.'));
    return { canProceed: false };
  }

  showStatus('Already logged in', 'success');
  return { canProceed: true };
}

export async function checkAndShowCodinStatus() {
  // 安装检查
  const install = checkCodinInstalled();
  if (!install.installed) {
    showWarning('codin is not installed.');
    console.log(chalk.gray('  Please install codin first.'));
    return { canProceed: false };
  }

  showStatus(`codin v${install.version} found`, 'success');

  // 登录检查
  const login = checkCodinLogin();
  if (!login.loggedIn) {
    showWarning('codin is not logged in.');
    console.log(chalk.gray('  Run: codin login'));
    return { canProceed: false };
  }

  showStatus(`Logged in as ${login.user}`, 'success');
  return { canProceed: true };
}
