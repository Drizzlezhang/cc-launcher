import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';

const config = new Conf({
  projectName: 'cc-launcher',
  configName: 'config',
  cwd: join(homedir(), '.config', 'cc-launcher'),
});

export function getConfig() {
  return {
    channel: config.get('channel') || 'newapi',
    // NewAPI 渠道配置
    baseurl: config.get('baseurl'),
    apikey: config.get('apikey'),
    selectedModel: config.get('selectedModel'),
    // Vertex 渠道配置
    projectId: config.get('projectId'),
    region: config.get('region'),
    vertexModel: config.get('vertexModel'),
    serviceAccountKeyPath: config.get('serviceAccountKeyPath'),
  };
}

export function getChannel() {
  return config.get('channel') || 'newapi';
}

export function setConfig(data) {
  if (data.channel !== undefined) config.set('channel', data.channel);
  // NewAPI
  if (data.baseurl !== undefined) config.set('baseurl', data.baseurl);
  if (data.apikey !== undefined) config.set('apikey', data.apikey);
  if (data.selectedModel !== undefined) config.set('selectedModel', data.selectedModel);
  // Vertex
  if (data.projectId !== undefined) config.set('projectId', data.projectId);
  if (data.region !== undefined) config.set('region', data.region);
  if (data.vertexModel !== undefined) config.set('vertexModel', data.vertexModel);
  if (data.serviceAccountKeyPath !== undefined) config.set('serviceAccountKeyPath', data.serviceAccountKeyPath);
}

export function clearConfig() {
  config.clear();
}

export function hasValidConfig() {
  const cfg = getConfig();
  const channel = cfg.channel || 'newapi';

  if (channel === 'vertex') {
    // Vertex 需要 projectId, region, vertexModel
    return !!(cfg.projectId && cfg.region && cfg.vertexModel);
  } else {
    // NewAPI 需要 baseurl, apikey, selectedModel
    return !!(cfg.baseurl && cfg.apikey && cfg.selectedModel);
  }
}

export default config;
