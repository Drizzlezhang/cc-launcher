import axios from 'axios';
import chalk from 'chalk';

export async function fetchModels(baseurl, apikey) {
  try {
    const url = `${baseurl.replace(/\/+$/, '')}/v1/models`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${apikey}`,
      },
      timeout: 30000,
    });

    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data.map((model) => model.id).filter(Boolean);
    }

    throw new Error('Invalid response format from API');
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 403) {
        throw new Error('Authentication failed. Please check your API key.');
      }
      throw new Error(`API request failed with status ${status}: ${error.response.statusText}`);
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(`Cannot connect to ${baseurl}. Please check the URL.`);
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
}
