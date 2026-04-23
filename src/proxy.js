import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { homedir } from 'os';
import { join } from 'path';

const LOCAL_PROXY_BASE_URL = 'http://127.0.0.1:18791';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkReachable(url, timeoutMs = 1200, acceptableStatuses = [200]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    return acceptableStatuses.includes(response.status);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function isLocalGatewayReady() {
  return checkReachable(`${LOCAL_PROXY_BASE_URL}/v1/models`);
}

function getProxyCommand(tool) {
  if (tool === 'coco') {
    return {
      command: 'sh',
      args: ['-lc', "printf 'n\\n' | coco gateway run"],
    };
  }
  if (tool === 'codin') {
    return {
      command: 'sh',
      args: ['-lc', "printf 'n\\n' | codin --acp"],
    };
  }
  throw new Error(`Unsupported proxy tool: ${tool}`);
}

function readTraeApiKey() {
  const configPath = join(homedir(), '.trae', 'traecli.yaml');
  if (!existsSync(configPath)) return '';

  try {
    const content = readFileSync(configPath, 'utf-8');
    const apiKeyMatch = content.match(/api_key:\s*(.+)/);
    return apiKeyMatch ? apiKeyMatch[1].trim() : '';
  } catch {
    return '';
  }
}

function buildProbeHeaders(token) {
  if (!token) return [{}];
  return [
    { Authorization: `Bearer ${token}` },
    { 'x-api-key': token },
    { Authorization: token },
  ];
}

function extractTextFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.type === 'text') return item.text || '';
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function buildPromptFromMessages(messages = []) {
  return messages
    .map((m) => {
      const role = (m?.role || 'user').toUpperCase();
      const text = extractTextFromContent(m?.content);
      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function formatCliError(tool, output, code) {
  const normalized = normalizeCliOutput(output);
  if (tool === 'coco' && /invalid api-key|invalid token|unauthorized/i.test(output)) {
    return 'coco upstream auth failed (invalid api-key/token). Please run `coco` to refresh login.';
  }
  return normalized || `${tool} CLI exited with code ${code}`;
}

async function runCliPrompt(tool, prompt, timeoutMs = Number(process.env.CC_LAUNCHER_BRIDGE_TIMEOUT_MS || 90000)) {
  const args = tool === 'codin' ? ['-p', prompt] : ['--print', prompt];

  return new Promise((resolve, reject) => {
    const child = spawn(tool, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${tool} CLI timed out`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.once('close', (code) => {
      clearTimeout(timer);
      const output = `${stdout}\n${stderr}`.trim();
      if (code === 0 && output) {
        resolve(output);
        return;
      }
      reject(new Error(formatCliError(tool, output, code)));
    });

    child.stdin.write('n\n');
    child.stdin.end();
  });
}

function normalizeCliOutput(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/是否立即更新|检测到新版本|已跳过更新|deprecationwarning|punycode|trace-deprecation/i.test(line))
    .join('\n')
    .trim();
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function startCliBridgeProxy(tool) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const path = url.pathname;
    const modelId = tool === 'coco' ? 'seeddance2.0' : 'seeddream2.0';

    if (req.method === 'GET' && path === '/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, tool }));
      return;
    }

    if (req.method === 'GET' && (path === '/v1/models' || path === '/models')) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        object: 'list',
        data: [
          {
            id: modelId,
            object: 'model',
            type: 'model',
            owned_by: tool,
            display_name: modelId,
          },
        ],
      }));
      return;
    }

    if (req.method === 'GET' && (path === `/v1/models/${modelId}` || path === `/models/${modelId}`)) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        id: modelId,
        object: 'model',
        type: 'model',
        owned_by: tool,
        display_name: modelId,
      }));
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('method_not_allowed');
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);

    let payload = {};
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
    } catch {
      res.statusCode = 400;
      res.end('invalid_json');
      return;
    }

    const isChatCompletions = path === '/v1/chat/completions';
    const isAnthropicMessages = path === '/v1/messages';

    if (!isChatCompletions && !isAnthropicMessages) {
      res.statusCode = 404;
      res.end('not_found');
      return;
    }

    const prompt = buildPromptFromMessages(payload.messages || []);
    if (!prompt) {
      res.statusCode = 400;
      res.end('empty_prompt');
      return;
    }

    try {
      const raw = await runCliPrompt(tool, prompt);
      const text = normalizeCliOutput(raw) || raw;
      const now = Math.floor(Date.now() / 1000);
      const model = modelId;

      if (isAnthropicMessages && payload.stream) {
        res.statusCode = 200;
        res.setHeader('content-type', 'text/event-stream; charset=utf-8');
        res.setHeader('cache-control', 'no-cache, no-transform');
        res.setHeader('connection', 'keep-alive');

        const messageId = `msg_${Date.now()}`;
        writeSse(res, 'message_start', {
          type: 'message_start',
          message: {
            id: messageId,
            type: 'message',
            role: 'assistant',
            model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });
        writeSse(res, 'content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        });
        writeSse(res, 'content_block_delta', {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text },
        });
        writeSse(res, 'content_block_stop', {
          type: 'content_block_stop',
          index: 0,
        });
        writeSse(res, 'message_delta', {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 0 },
        });
        writeSse(res, 'message_stop', { type: 'message_stop' });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      if (isAnthropicMessages) {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model,
          content: [{ type: 'text', text }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        }));
        return;
      }

      if (isChatCompletions && payload.stream) {
        res.statusCode = 200;
        res.setHeader('content-type', 'text/event-stream; charset=utf-8');
        res.setHeader('cache-control', 'no-cache, no-transform');
        res.setHeader('connection', 'keep-alive');

        const id = `chatcmpl_${Date.now()}`;
        writeSse(res, 'message', {
          id,
          object: 'chat.completion.chunk',
          created: now,
          model,
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
        });
        writeSse(res, 'message', {
          id,
          object: 'chat.completion.chunk',
          created: now,
          model,
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
        });
        writeSse(res, 'message', {
          id,
          object: 'chat.completion.chunk',
          created: now,
          model,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        id: `chatcmpl_${Date.now()}`,
        object: 'chat.completion',
        created: now,
        model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }));
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { message: error.message } }));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    tool,
    child: null,
    baseUrl: `http://127.0.0.1:${port}`,
    authToken: '',
    close: async () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function probeProxyAuth(baseUrl, authToken) {
  const headersList = buildProbeHeaders(authToken);

  for (const headers of headersList) {
    try {
      const res = await fetch(`${baseUrl}/v1/models`, { method: 'GET', headers });
      const body = await res.text();
      const ok = res.status >= 200 && res.status < 300;
      if (ok) {
        return {
          ok: true,
          status: res.status,
          headers,
          bodyPreview: body.slice(0, 240),
        };
      }
    } catch {
      // continue probing
    }
  }

  try {
    const res = await fetch(`${baseUrl}/v1/models`, { method: 'GET' });
    const body = await res.text();
    return {
      ok: false,
      status: res.status,
      headers: {},
      bodyPreview: body.slice(0, 240),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: {},
      bodyPreview: error.message,
    };
  }
}

export async function startProxySidecar(tool) {
  if (await isLocalGatewayReady()) {
    return {
      tool,
      child: null,
      baseUrl: LOCAL_PROXY_BASE_URL,
      authToken: readTraeApiKey(),
    };
  }

  return startCliBridgeProxy(tool);
}

export async function startTrafficLoggerProxy(targetBaseUrl, authToken, authHeaders = null) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyBuffer = Buffer.concat(chunks);

    const upstreamHeaders = { ...req.headers };
    delete upstreamHeaders.host;

    if (authHeaders && Object.keys(authHeaders).length > 0) {
      Object.assign(upstreamHeaders, authHeaders);
    } else if (authToken && !upstreamHeaders.authorization && !upstreamHeaders['x-api-key']) {
      upstreamHeaders.authorization = `Bearer ${authToken}`;
    }

    const requestUrl = `${targetBaseUrl}${req.url}`;

    try {
      const upstream = await fetch(requestUrl, {
        method: req.method,
        headers: upstreamHeaders,
        body: bodyBuffer.length > 0 ? bodyBuffer : undefined,
      });

      const responseBuf = Buffer.from(await upstream.arrayBuffer());
      const responseTextPreview = responseBuf.toString('utf-8').slice(0, 400).replace(/\n/g, ' ');

      console.error(`[cc-launcher proxy] ${req.method} ${req.url} -> ${upstream.status}`);
      if (bodyBuffer.length > 0) {
        console.error(`[cc-launcher proxy] request: ${bodyBuffer.toString('utf-8').slice(0, 400).replace(/\n/g, ' ')}`);
      }
      console.error(`[cc-launcher proxy] response: ${responseTextPreview}`);

      res.statusCode = upstream.status;
      upstream.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'content-encoding') return;
        if (key.toLowerCase() === 'transfer-encoding') return;
        res.setHeader(key, value);
      });
      res.end(responseBuf);
    } catch (error) {
      res.statusCode = 502;
      res.end(`proxy_error: ${error.message}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function stopProxySidecar(sidecar) {
  if (!sidecar) return;
  if (typeof sidecar.close === 'function') {
    await sidecar.close();
  }
  if (!sidecar.child || sidecar.child.killed) return;
  sidecar.child.kill('SIGTERM');
}
