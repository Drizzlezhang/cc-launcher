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
    baseurl: config.get('baseurl'),
    apikey: config.get('apikey'),
    selectedModel: config.get('selectedModel'),
  };
}

export function setConfig(data) {
  if (data.baseurl !== undefined) config.set('baseurl', data.baseurl);
  if (data.apikey !== undefined) config.set('apikey', data.apikey);
  if (data.selectedModel !== undefined) config.set('selectedModel', data.selectedModel);
}

export function clearConfig() {
  config.clear();
}

export function hasValidConfig() {
  const { baseurl, apikey, selectedModel } = getConfig();
  return !!(baseurl && apikey && selectedModel);
}

export default config;
