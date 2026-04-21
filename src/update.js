import axios from 'axios';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { showStatus } from './banner.js';

const NPM_REGISTRY = 'https://npm.pkg.github.com/@drizzlezhang/cc-launcher';
const NPM_PACKAGE = '@drizzlezhang/cc-launcher';

/**
 * 获取当前版本
 */
export function getCurrentVersion() {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(execSync(`cat ${pkgUrl.pathname}`, { encoding: 'utf-8' }));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

/**
 * 从 npm registry 获取最新版本
 */
export async function getLatestVersion() {
  try {
    const response = await axios.get(NPM_REGISTRY, {
      timeout: 5000,
      headers: {
        'Accept': 'application/vnd.npm.install-v1+json',
      },
    });

    if (response.data && response.data['dist-tags'] && response.data['dist-tags'].latest) {
      return response.data['dist-tags'].latest;
    }

    // 备用：直接解析 versions
    if (response.data && response.data.versions) {
      const versions = Object.keys(response.data.versions);
      return versions.sort().pop();
    }

    return null;
  } catch (error) {
    // 尝试公共 npm registry
    try {
      const response = await axios.get(`https://registry.npmjs.org/${NPM_PACKAGE}`, {
        timeout: 5000,
      });

      if (response.data && response.data['dist-tags'] && response.data['dist-tags'].latest) {
        return response.data['dist-tags'].latest;
      }
    } catch {
      return null;
    }
    return null;
  }
}

/**
 * 比较版本号
 */
function compareVersions(current, latest) {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (cv < lv) return -1;
    if (cv > lv) return 1;
  }
  return 0;
}

/**
 * 检查更新
 */
export async function checkForUpdate() {
  const currentVersion = getCurrentVersion();

  showStatus('Checking for updates...', 'loading');

  const latestVersion = await getLatestVersion();

  if (!latestVersion) {
    showStatus('Could not check for updates', 'warning');
    return { hasUpdate: false, currentVersion, latestVersion: null };
  }

  const comparison = compareVersions(currentVersion, latestVersion);

  if (comparison < 0) {
    return { hasUpdate: true, currentVersion, latestVersion };
  }

  showStatus(`Already on latest version (${currentVersion})`, 'success');
  return { hasUpdate: false, currentVersion, latestVersion };
}

/**
 * 执行更新
 */
export async function performUpdate(latestVersion) {
  console.log();
  showStatus(`Updating to v${latestVersion}...`, 'loading');
  console.log();

  try {
    // 使用 npm 全局更新
    execSync(`npm install -g ${NPM_PACKAGE}@latest`, {
      stdio: 'inherit',
    });

    console.log();
    showStatus(`Successfully updated to v${latestVersion}!`, 'success');
    console.log();
    return true;
  } catch (error) {
    showStatus('Update failed. Try manually:', 'error');
    console.log(chalk.cyan(`  npm install -g ${NPM_PACKAGE}@latest`));
    console.log();
    return false;
  }
}
