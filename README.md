# DockBrain

**Local-first task automation assistant with security by default.**

DockBrain is an intelligent assistant that lives in Telegram and executes real actions on your behalf: manage files, create reminders, fetch web content, and more. Designed with security, reliability, and user control as top priorities.

## Features

- **Secure by Default**: Granular permissions per tool and action, pairing-based authentication, full audit logging
- **Reliable Execution**: Plan → Execute → Verify cycle ensures tasks complete correctly
- **Local-First**: All data stored locally in SQLite, no external dependencies
- **LLM-Powered**: Uses GPT-4, Ollama (local LLMs), or mock provider for intelligent task planning
- **100% Private with Ollama**: Run completely offline with local AI models (no data leaves your computer)
- **Telegram Integration**: Chat-based interface for ease of use
- **Browser Automation**: Screenshots, form fill, and data extraction
- **File Write/Edit**: Safe-root file operations with backups
- **System Exec**: Allowlisted command execution with confirmations
- **Memory**: Persistent per-user memory + prompt context
- **Sessions**: Multi-agent sessions with persistence

## 🦙 NEW: Local LLMs with Ollama

DockBrain now supports **Ollama** for running AI models completely locally and for free!

- **No API costs**: Run models on your own hardware
- **100% Private**: No data sent to external servers
- **Offline capable**: Works without internet after initial setup
- **Multiple models**: Choose from Llama 3.2, Mistral, Phi-3, and more

**See [SETUP_WINDOWS.md](SETUP_WINDOWS.md) for complete setup instructions including Ollama installation.**

## Quick Start

### 🪟 Windows Users
See detailed guide: **[SETUP_WINDOWS.md](SETUP_WINDOWS.md)**

### 🐧 Linux Users (VPS/Server)

**Automated installation (recommended):**
```bash
curl -fsSL https://raw.githubusercontent.com/BaAlvaro/dockbrain/main/install.sh | sudo bash
```

Or see detailed guide: **[SETUP_LINUX.md](SETUP_LINUX.md)**

**Docker installation:**
```bash
git clone https://github.com/BaAlvaro/dockbrain.git
cd dockbrain
cp .env.example .env
nano .env  # Configure
docker-compose up -d
```

### 💻 Manual Installation (All Platforms)

#### Prerequisites

- Node.js 20+ LTS
- Telegram Bot Token (get from [@BotFather](https://t.me/BotFather))
- **Choose one LLM provider:**
  - **Ollama** (recommended): Free, local, private
  - **OpenAI**: Paid API - requires API key
  - **Google Gemini**: API key required
  - **OpenRouter**: API key + model selection
  - **DeepSeek**: API key required
  - **Mock**: For testing only

#### Installation Steps

1. **Clone and install dependencies:**

```bash
git clone https://github.com/BaAlvaro/dockbrain.git
cd dockbrain
npm install
```

2. **Configure environment:**

```bash
cp .env.example .env
```

Edit `.env` and add your tokens:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ADMIN_API_TOKEN=generate_secure_random_token

# For Ollama (local, free):
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# OR for OpenAI (paid):
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your_openai_api_key

# OR for DeepSeek:
# LLM_PROVIDER=deepseek
# DEEPSEEK_API_KEY=your_deepseek_api_key
# DEEPSEEK_MODEL=deepseek-chat
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

Generate a secure admin token:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. **Build and start:**

```bash
npm run build
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## First Time Setup

### 1. Create a Pairing Token

Use the HTTP API to generate a pairing token:

```bash
curl -X POST http://localhost:3000/api/v1/pairing/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttl_minutes": 60}'
```

Response:
```json
{
  "token": "AbCdEfGh12345678XyZ1234",
  "expires_at": 1706544000
}
```

### 2. Pair Your Telegram Account

In Telegram, message your bot:

```
/pair AbCdEfGh12345678XyZ1234
```

You'll receive confirmation and default permissions (reminders, system info).

### 3. Grant Additional Permissions

To allow file access:

```bash
curl -X PUT http://localhost:3000/api/v1/users/1/permissions \
  -H "Authorization: Bearer YOUR_ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": [
      {
        "tool_name": "files_readonly",
        "action": "read",
        "granted": true,
        "requires_confirmation": false
      },
      {
        "tool_name": "files_readonly",
        "action": "list",
        "granted": true,
        "requires_confirmation": false
      },
      {
        "tool_name": "reminders",
        "action": "*",
        "granted": true,
        "requires_confirmation": false
      },
      {
        "tool_name": "web_sandbox",
        "action": "fetch",
        "granted": true,
        "requires_confirmation": false
      }
    ]
  }'
```

## Usage Examples

### Create Reminders

```
Remind me tomorrow at 10am to call John
```

### List Reminders

```
Show me my reminders
```

### Read Files

```
Read the file notes.txt
```

### Fetch Web Content

```
Fetch content from https://wikipedia.org/wiki/Artificial_intelligence
```

### System Information

```
Show system info
```

## Available Commands

- `/help` - Show help message
- `/status` - Check your pairing status
- `/pair <token>` - Pair your account with a token

## Configuration

### Environment Variables

See `.env.example` for all available options.

Key variables:
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `ADMIN_API_TOKEN` - Secure token for HTTP API access
- `LLM_PROVIDER` - `openai`, `ollama`, `gemini`, `openrouter`, `deepseek`, or `mock`
- `OPENAI_API_KEY` - Your OpenAI API key
- `GEMINI_API_KEY` - Your Gemini API key
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `DEEPSEEK_API_KEY` - Your DeepSeek API key
- `SAFE_ROOT_DIR` - Directory for file operations (default: `./data/safe_root`)

### config/default.yaml

Customize:
- Security settings (rate limits, timeouts)
- Allowed web domains for `web_sandbox`
- Tool-specific settings (file size limits, reminder limits)

## HTTP API

Base URL: `http://localhost:3000/api/v1`

All endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>` header.

### Pairing

- `POST /pairing/tokens` - Create pairing token
- `GET /pairing/tokens` - List active tokens

### Users

- `GET /users` - List all users
- `PATCH /users/:id` - Update user (activate/deactivate, rate limit)
- `DELETE /users/:id` - Delete user

### Permissions

- `GET /users/:id/permissions` - Get user permissions
- `PUT /users/:id/permissions` - Set user permissions

### Tasks

- `GET /tasks` - List tasks (filter by status, user_id)
- `GET /tasks/:id` - Get task details

### Audit

- `GET /audit` - Query audit logs (filter by user_id, time range)

### Health

- `GET /health` - System health check

## Security

See [SECURITY.md](SECURITY.md) for detailed security model and best practices.

Key security features:
- Mandatory pairing with one-time tokens
- Granular permissions per tool and action
- Confirmation required for destructive operations
- Full audit logging
- Path traversal protection
- SSRF protection with domain allowlist
- Rate limiting per user

## Development

### Run Tests

```bash
npm test
```

With coverage:
```bash
npm run test:coverage
```

### Project Structure

```
src/
├── core/               # Core components
│   ├── agent/          # LLM agent runtime
│   ├── gateway/        # HTTP API and message queue
│   ├── orchestrator/   # Task execution engine
│   └── security/       # Security managers
├── connectors/         # External integrations
│   └── telegram/       # Telegram bot
├── persistence/        # Database layer
│   ├── migrations/     # SQL migrations
│   └── repositories/   # Data access
├── tools/              # Tool implementations
├── types/              # TypeScript types
└── utils/              # Utilities
```

### Adding New Tools

1. Create tool class extending `BaseTool` in `src/tools/`
2. Define actions with Zod schemas
3. Implement `executeAction` method
4. Register tool in `ToolRegistry`
5. Update config schema if needed

Example:
```typescript
export class MyTool extends BaseTool {
  getName() { return 'my_tool'; }

  getActions() {
    return {
      do_something: {
        description: 'Does something',
        parameters: z.object({
          param: z.string(),
        }),
      },
    };
  }

  protected async executeAction(action, params, context) {
    // Implementation
  }
}
```

## Troubleshooting

### Bot not responding

1. Check Telegram bot token is correct
2. Verify bot is running: `curl http://localhost:3000/api/v1/health`
3. Check logs in `./data/logs/`

### Permission denied errors

1. Check user has required permissions: `GET /api/v1/users/:id/permissions`
2. Grant permissions via API: `PUT /api/v1/users/:id/permissions`

### Database errors

1. Ensure `./data/` directory exists and is writable
2. Check database file permissions
3. Try deleting `dockbrain.db` and restarting (WARNING: loses all data)

### LLM errors

1. If using OpenAI, verify API key is valid
2. Check API key has sufficient credits
3. For testing, switch to mock provider: `LLM_PROVIDER=mock`

## License

MIT

## Contributing

This is a reference implementation. Feel free to fork and modify for your needs.

For production use, consider:
- Adding authentication to HTTP API (beyond bearer token)
- Implementing backup/restore functionality
- Adding more tools based on your needs
- Setting up monitoring and alerting
- Implementing email/calendar integration (post-MVP)
