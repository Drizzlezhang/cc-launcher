# CC-Launcher

A CLI tool to manage API configurations and launch Claude Code CLI with support for multiple providers.

## Features

- **Multiple API Providers**: NewAPI, Kimi Coding Plan, Google Vertex AI (Gemini)
- **Work/Personal Modes**: Separate configurations for work and personal use
- **Interactive Configuration**: Easy-to-use configuration wizard
- **Auto Model Discovery**: Fetches available models from your API endpoint

## Installation

```bash
npm install -g @drizzlezhang/cc-launcher
```

Or clone and link locally:

```bash
git clone https://github.com/Drizzlezhang/cc-launcher.git
cd cc-launcher
npm link
```

## Usage

### Basic Commands

```bash
# Launch Claude Code with current config
cc-launcher

# Run interactive configuration
cc-launcher --config

# Show current configuration status
cc-launcher --status

# Switch between work/personal mode
cc-launcher --mode work
cc-launcher --mode personal

# Check and update to latest version
cc-launcher --update

# Clear all configuration
cc-launcher --clear
```

### Auto-Update

When launching `cc-launcher`, it automatically checks for updates. If a new version is available, you'll be prompted to update:

```
📦 New version available: v1.4.0 (current: v1.3.0)

? Update to the latest version? (Y/n)
```

You can also manually check for updates:

```bash
cc-launcher --update
```

### Configuration Flow

1. **Select Mode**: Choose between Personal (your own config) or Work (company environment)
2. **Choose Provider**: 
   - **NewAPI**: OpenAI-compatible endpoint
   - **Kimi Coding Plan**: Moonshot's Kimi API
   - **Google Vertex AI**: Gemini models via proxy
3. **Enter Credentials**: API keys and endpoints
4. **Select Model**: Choose from available models

### Provider Setup

#### NewAPI (OpenAI-compatible)

```
cc-launcher --config
# Select: Personal -> NewAPI
# Enter your API endpoint URL
# Enter your API key
# Select model from list
```

#### Kimi Coding Plan

```
cc-launcher --config
# Select: Personal -> Kimi Coding Plan
# Enter your Kimi API key
# Select model from list
```

#### Google Vertex AI (Gemini)

Requires [claude-code-proxy](https://github.com/1rgs/claude-code-proxy) to translate API formats.

```bash
# 1. Start the proxy first
git clone https://github.com/1rgs/claude-code-proxy
cd claude-code-proxy
uv run uvicorn server:app --host 0.0.0.0 --port 8082

# 2. Configure cc-launcher
cc-launcher --config
# Select: Personal -> Google Vertex AI
# Enter GCP Project ID
# Select region (global recommended)
# Select Gemini model (3.1 Pro, 3.1 Flash-Lite, etc.)
# Enter proxy URL (default: http://localhost:8082)
```

**Prerequisites for Vertex AI**:
- Install [gcloud CLI](https://cloud.google.com/sdk/docs/install)
- Run `gcloud auth application-default login` for authentication

## Configuration Storage

Configuration is stored at `~/.config/cc-launcher/config.json`:

```json
{
  "mode": "personal",
  "personal": {
    "channel": "newapi",
    "baseurl": "https://your-api-endpoint.com",
    "apikey": "your-api-key",
    "selectedModel": "claude-sonnet-4-6"
  },
  "work": {
    "baseurl": "https://company-api.com",
    "apikey": "company-api-key",
    "selectedModel": "model-id"
  }
}
```

## Environment Variables

The tool sets these environment variables in `~/.claude/settings.drizzle.json`:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_BASE_URL` | API endpoint URL |
| `ANTHROPIC_AUTH_TOKEN` | API key (NewAPI) |
| `ANTHROPIC_API_KEY` | API key (Kimi) |
| `ANTHROPIC_MODEL` | Selected model |
| `VERTEX_PROJECT` | GCP Project ID (Vertex) |
| `VERTEX_LOCATION` | GCP Region (Vertex) |
| `USE_VERTEX_AUTH` | Use ADC auth (Vertex) |

## Requirements

- Node.js 18+
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- For Vertex AI: gcloud CLI, Python/uv for proxy

## License

MIT
