import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';

const config = new Conf({
  projectName: 'cc-launcher',
  configName: 'config',
  cwd: join(homedir(), '.config', 'cc-launcher'),
});

/**
 * 获取原始配置对象
 */
export function getRawConfig() {
  return {
    mode: config.get('mode') || 'personal',
    work: config.get('work') || {},
    personal: config.get('personal') || {},
  };
}

/**
 * 设置当前模式
 */
export function setMode(mode) {
  config.set('mode', mode);
}

/**
 * 获取当前模式
 */
export function getMode() {
  return config.get('mode') || 'personal';
}

/**
 * 获取 work 配置
 */
export function getWorkConfig() {
  return config.get('work') || {};
}

/**
 * 获取 personal 配置
 */
export function getPersonalConfig() {
  return config.get('personal') || {};
}

/**
 * 获取当前模式的完整配置
 */
export function getConfig() {
  const mode = getMode();

  if (mode === 'work') {
    const work = getWorkConfig();
    return {
      mode: 'work',
      channel: work.channel || 'newapi',
      baseurl: work.baseurl,
      apikey: work.apikey,
      selectedModel: work.selectedModel,
    };
  } else {
    const personal = getPersonalConfig();
    return {
      mode: 'personal',
      channel: personal.channel || 'newapi',
      baseurl: personal.baseurl,
      apikey: personal.apikey,
      kimiApikey: personal.kimiApikey,
      selectedModel: personal.selectedModel,
      projectId: personal.projectId,
      region: personal.region,
      vertexModel: personal.vertexModel,
      proxyUrl: personal.proxyUrl,
    };
  }
}

/**
 * 获取当前渠道
 */
export function getChannel() {
  const mode = getMode();
  if (mode === 'work') {
    const work = getWorkConfig();
    return work.channel || 'newapi';
  }
  const personal = getPersonalConfig();
  return personal.channel || 'newapi';
}

/**
 * 设置配置（自动根据 mode 存储到对应区域）
 */
export function setConfig(data) {
  if (data.mode !== undefined) {
    config.set('mode', data.mode);
  }

  const mode = data.mode || getMode();

  if (mode === 'work') {
    const work = getWorkConfig();
    if (data.channel !== undefined) work.channel = data.channel;
    if (data.baseurl !== undefined) work.baseurl = data.baseurl;
    if (data.apikey !== undefined) work.apikey = data.apikey;
    if (data.selectedModel !== undefined) work.selectedModel = data.selectedModel;
    config.set('work', work);
  } else {
    const personal = getPersonalConfig();
    if (data.channel !== undefined) personal.channel = data.channel;
    if (data.baseurl !== undefined) personal.baseurl = data.baseurl;
    if (data.apikey !== undefined) personal.apikey = data.apikey;
    if (data.kimiApikey !== undefined) personal.kimiApikey = data.kimiApikey;
    if (data.selectedModel !== undefined) personal.selectedModel = data.selectedModel;
    if (data.projectId !== undefined) personal.projectId = data.projectId;
    if (data.region !== undefined) personal.region = data.region;
    if (data.vertexModel !== undefined) personal.vertexModel = data.vertexModel;
    if (data.proxyUrl !== undefined) personal.proxyUrl = data.proxyUrl;
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
 * 检查 work 模式是否有有效配置
 */
export function hasWorkConfig() {
  const work = getWorkConfig();
  const channel = work.channel || 'newapi';

  if (channel === 'aiden' || channel === 'ttadk') {
    return true;
  } else {
    return !!(work.baseurl && work.apikey && work.selectedModel);
  }
}

/**
 * 检查 personal 模式是否有有效配置
 */
export function hasPersonalConfig() {
  const personal = getPersonalConfig();
  const channel = personal.channel || 'newapi';

  if (channel === 'vertex') {
    return !!(personal.projectId && personal.vertexModel && personal.proxyUrl);
  } else if (channel === 'kimi') {
    return !!(personal.kimiApikey && personal.selectedModel);
  } else {
    return !!(personal.baseurl && personal.apikey && personal.selectedModel);
  }
}

/**
 * 检查当前模式是否有有效配置
 */
export function hasValidConfig() {
  const mode = getMode();
  return mode === 'work' ? hasWorkConfig() : hasPersonalConfig();
}

export default config;
