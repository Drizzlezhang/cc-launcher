import { execSync } from 'child_process';
import chalk from 'chalk';

// Vertex AI 可用的 Claude 模型列表
export const VERTEX_MODELS = [
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7 (最新)', context: '1M' },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', context: '1M' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', context: '1M' },
  { id: 'claude-sonnet-4-5@20250929', name: 'Claude Sonnet 4.5', context: '200K' },
  { id: 'claude-haiku-4-5@20251001', name: 'Claude Haiku 4.5 (快速)', context: '200K' },
];

// 支持的 Region 列表
export const VERTEX_REGIONS = [
  { id: 'global', name: 'Global (推荐)', description: '全球端点，自动路由' },
  { id: 'us-east5', name: 'US East 5', description: '美国东部' },
  { id: 'us-central1', name: 'US Central 1', description: '美国中部' },
  { id: 'europe-west1', name: 'Europe West 1', description: '欧洲西部' },
  { id: 'europe-west4', name: 'Europe West 4', description: '欧洲西部' },
  { id: 'asia-east1', name: 'Asia East 1', description: '亚洲东部' },
  { id: 'asia-southeast1', name: 'Asia Southeast 1', description: '亚洲东南' },
];

/**
 * 检查 gcloud CLI 是否已安装
 */
export function isGcloudInstalled() {
  try {
    execSync('which gcloud', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查 ADC (Application Default Credentials) 是否已配置
 */
export function hasAdcConfigured() {
  try {
    execSync('gcloud auth application-default print-access-token', {
      stdio: 'ignore',
      timeout: 5000
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取当前 gcloud 配置的项目 ID
 */
export function getCurrentProjectId() {
  try {
    const projectId = execSync('gcloud config get-value project', {
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
    return projectId || null;
  } catch {
    return null;
  }
}

/**
 * 打印 GCP 认证设置指南
 */
export function printAuthGuide() {
  console.log();
  console.log(chalk.yellow('GCP 认证设置指南:'));
  console.log();
  console.log(chalk.gray('方式一: 使用 gcloud CLI (推荐)'));
  console.log(chalk.cyan('  gcloud auth application-default login'));
  console.log();
  console.log(chalk.gray('方式二: 使用 Service Account Key'));
  console.log(chalk.gray('  1. 在 GCP Console 创建 Service Account'));
  console.log(chalk.gray('  2. 下载 JSON 密钥文件'));
  console.log(chalk.gray('  3. 配置时提供密钥文件路径'));
  console.log();
  console.log(chalk.gray('更多信息: https://cloud.google.com/docs/authentication'));
  console.log();
}

/**
 * 验证 Vertex AI 配置
 */
export async function validateVertexConfig(projectId, region) {
  const issues = [];

  if (!isGcloudInstalled()) {
    issues.push('gcloud CLI 未安装。请先安装 Google Cloud SDK');
  }

  if (!hasAdcConfigured()) {
    issues.push('ADC 未配置。请运行: gcloud auth application-default login');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
