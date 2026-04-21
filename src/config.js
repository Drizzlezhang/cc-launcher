import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';

const config = new Conf({
  projectName: 'cc-launcher',
  configName: 'config',
  cwd: join(homedir(), '.config', 'cc-launcher'),
});

/**
 * 获取当前模式
 */
export function getMode() {
  return config.get('mode') || 'personal';
}

/**
 * 获取当前模式的完整配置
 */
export function getConfig() {
  const mode = getMode();

  if (mode === 'work') {
    const work = config.get('work') || {};
    return {
      mode: 'work',
      channel: 'newapi',
      baseurl: work.baseurl,
      apikey: work.apikey,
      selectedModel: work.selectedModel,
    };
  } else {
    const personal = config.get('personal') || {};
    return {
      mode: 'personal',
      channel: personal.channel || 'newapi',
      // NewAPI
      baseurl: personal.baseurl,
      apikey: personal.apikey,
      selectedModel: personal.selectedModel,
      // Vertex
      projectId: personal.projectId,
      region: personal.region,
      vertexModel: personal.vertexModel,
      serviceAccountKeyPath: personal.serviceAccountKeyPath,
    };
  }
}

/**
 * 获取当前渠道
 */
export function getChannel() {
  const mode = getMode();
  if (mode === 'work') {
    return 'newapi';
  }
  const personal = config.get('personal') || {};
  return personal.channel || 'newapi';
}

/**
 * 设置配置（自动根据 mode 存储到对应区域）
 */
export function setConfig(data) {
  // 更新 mode
  if (data.mode !== undefined) {
    config.set('mode', data.mode);
  }

  const mode = data.mode || getMode();

  if (mode === 'work') {
    // 保存到 work 区域
    const work = config.get('work') || {};
    if (data.baseurl !== undefined) work.baseurl = data.baseurl;
    if (data.apikey !== undefined) work.apikey = data.apikey;
    if (data.selectedModel !== undefined) work.selectedModel = data.selectedModel;
    config.set('work', work);
  } else {
    // 保存到 personal 区域
    const personal = config.get('personal') || {};
    if (data.channel !== undefined) personal.channel = data.channel;
    // NewAPI
    if (data.baseurl !== undefined) personal.baseurl = data.baseurl;
    if (data.apikey !== undefined) personal.apikey = data.apikey;
    if (data.selectedModel !== undefined) personal.selectedModel = data.selectedModel;
    // Vertex
    if (data.projectId !== undefined) personal.projectId = data.projectId;
    if (data.region !== undefined) personal.region = data.region;
    if (data.vertexModel !== undefined) personal.vertexModel = data.vertexModel;
    if (data.serviceAccountKeyPath !== undefined) personal.serviceAccountKeyPath = data.serviceAccountKeyPath;
    config.set('personal', personal);
  }
}

/**
 * 清除所有配置
 */
export function clearConfig() {
  config.clear();
}

/**
 * 检查当前模式是否有有效配置
 */
export function hasValidConfig() {
  const mode = getMode();

  if (mode === 'work') {
    const work = config.get('work') || {};
    return !!(work.baseurl && work.apikey && work.selectedModel);
  } else {
    const personal = config.get('personal') || {};
    const channel = personal.channel || 'newapi';

    if (channel === 'vertex') {
      return !!(personal.projectId && personal.region && personal.vertexModel);
    } else {
      return !!(personal.baseurl && personal.apikey && personal.selectedModel);
    }
  }
}

export default config;
