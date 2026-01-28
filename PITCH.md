# DockBrain - Texto de Presentación

## 📱 Versión Corta (Twitter/Reddit Title)

**DockBrain: Security-first AI automation assistant for Telegram with 100% local LLM support (Ollama) and granular permissions. Like MoltBot but with audit logging, pairing-based auth, and privacy-first design. Open source & self-hosted.**

---

## 🎯 Versión Media (Reddit Post / Hacker News)

### DockBrain - Secure, Private, Auditable AI Assistant

Hey everyone! I built **DockBrain**, a local-first task automation assistant that runs in Telegram.

**What makes it different from MoltBot/other AI assistants:**

🔐 **Security by Default**
- Pairing-based authentication (one-time tokens)
- Granular permissions per tool and action
- Full audit logging of every operation
- Confirmation prompts for destructive actions
- Path traversal & SSRF protection built-in

🔒 **100% Private with Ollama**
- Run completely offline with local AI models (Llama 3.2, Mistral, etc.)
- No data leaves your computer
- No API costs
- Works without internet after setup

✅ **Plan → Execute → Verify Cycle**
- Unlike other assistants, DockBrain verifies task completion
- Retries on failure
- Full execution logs

**Current Features:**
- File operations (read-only for now, write coming soon)
- Smart reminders with natural language parsing
- Web content fetching (SSRF-protected)
- Gmail OAuth integration with Pub/Sub hooks
- SMTP email sending
- System info
- Multiple LLM providers (OpenAI, Ollama, Gemini, OpenRouter)

**Tech Stack:**
- TypeScript + Node.js
- SQLite for local-first storage
- Telegram (grammY)
- Fastify API server
- Full test coverage

**Installation:**
```bash
# Linux/VPS (one-liner)
curl -fsSL https://raw.githubusercontent.com/BaAlvaro/dockbrain/main/install.sh | sudo bash

# Or manually with npm
git clone https://github.com/BaAlvaro/dockbrain
cd dockbrain && npm install && npm run build
```

**Roadmap (next 1-2 months):**
- File write/edit tools
- Shell execution with allowlists
- Persistent memory (USER.md style)
- Browser automation (Playwright)
- Cron/scheduled tasks
- Skills system

**Why I built this:**
I love MoltBot's functionality but wanted something with:
- More granular security controls
- Full audit trail for compliance
- 100% local operation option
- Single-user design with proper permissions

**Looking for:**
- Feedback on the security model
- Contributors for new tools
- Use cases I haven't thought of
- Skill ideas

GitHub: https://github.com/BaAlvaro/dockbrain
License: MIT

Would love to hear your thoughts! 🚀

---

## 📝 Versión Larga (Blog Post / GitHub README)

# Introducing DockBrain: A Security-First AI Assistant

## The Problem

AI assistants like MoltBot are incredibly powerful, but they often lack:
- Granular permission controls
- Full audit trails
- Privacy guarantees (everything goes through APIs)
- Single-user security model

When you're running automation on your personal computer or VPS, you need:
1. **Trust** - Know exactly what the AI can and cannot do
2. **Privacy** - Keep your data local
3. **Auditability** - Track every action taken
4. **Control** - Approve destructive operations before they happen

## The Solution: DockBrain

DockBrain is a local-first task automation assistant designed from the ground up with security, privacy, and auditability as core principles.

### Architecture Principles

**1. Pairing-Based Authentication**
- Generate one-time pairing tokens via HTTP API
- No hardcoded credentials
- Each Telegram user must explicitly pair
- Tokens expire and are single-use

**2. Granular Permissions**
- Every tool has specific actions (e.g., `files_readonly.read`, `files_readonly.list`)
- Permissions set per user, per action
- Confirmation prompts for destructive operations
- Default deny (explicit grants required)

**3. Full Audit Logging**
- Every action logged to SQLite
- Track: who, what, when, result
- Query logs via HTTP API
- Immutable audit trail

**4. Plan → Execute → Verify**
- AI creates execution plan
- Execute with error handling
- Verify results match expectations
- Retry on failure, log everything

**5. 100% Local Operation**
- Ollama integration for local LLMs
- SQLite for data storage
- No external dependencies required
- Works completely offline after setup

### Current Capabilities

**Tools (9):**
- `files_readonly` - Read files with extension filtering
- `reminders` - Smart reminders with NLP time parsing
- `web_sandbox` - SSRF-protected web fetching
- `system_info` - System information
- `email` - SMTP email sending
- `gmail` - OAuth + Pub/Sub hooks (MoltBot-inspired)
- `codex_auth` - Codex authentication
- `network_tools` - Network diagnostics
- `system_exec` - Safe Linux command execution

**LLM Providers (5):**
- OpenAI (GPT-4)
- Ollama (Llama 3.2, Mistral, Phi-3, etc.)
- Google Gemini
- OpenRouter (100+ models)
- Mock (testing)

**Security Features:**
- Path traversal protection
- SSRF protection with domain allowlists
- Rate limiting per user
- Input sanitization
- Confirmation prompts
- Permission snapshots (track exactly what permissions were used)

### Installation

**Linux/VPS (Automated):**
```bash
curl -fsSL https://raw.githubusercontent.com/BaAlvaro/dockbrain/main/install.sh | sudo bash
```

**Docker:**
```bash
git clone https://github.com/BaAlvaro/dockbrain
cd dockbrain
docker-compose up -d
```

**Manual:**
```bash
git clone https://github.com/BaAlvaro/dockbrain
cd dockbrain
npm install
cp .env.example .env
# Edit .env with your Telegram bot token
npm run build
npm start
```

### Usage Example

1. **Pair your Telegram account:**
```bash
curl -X POST http://localhost:3000/api/v1/pairing/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"ttl_minutes": 60}'
```

2. **In Telegram:**
```
/pair ABC123TOKEN
```

3. **Grant permissions:**
```bash
curl -X PUT http://localhost:3000/api/v1/users/1/permissions \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"permissions": [...]}'
```

4. **Use it:**
```
Remind me tomorrow at 10am to call John
Read the file config.yaml
Fetch content from https://example.com
```

### Roadmap

**Phase 1 (Next 2 weeks) - Quick Wins:**
- File write/edit tools
- Shell execution with allowlists
- Basic persistent memory (USER.md)
- Cron/scheduled tasks

**Phase 2 (1-2 months) - Core Features:**
- Browser automation (Playwright)
- Multi-agent sessions
- Webhooks system
- Skills system (SKILL.md format)

**Phase 3 (3-6 months) - Expansion:**
- Skills registry
- Media handling
- More integrations (Calendar, GitHub, etc.)
- 2-3 more messaging platforms

### Comparison with MoltBot

**MoltBot Advantages:**
- 13+ messaging platforms vs. 1
- 100+ public skills
- Multi-agent support
- Full browser automation
- Larger community (30K+ stars)

**DockBrain Advantages:**
- More granular permission system
- Full audit logging
- Plan-Execute-Verify cycle
- 100% local operation with Ollama
- Better security documentation
- Simpler, cleaner codebase
- Single-user focused design

**Positioning:**
DockBrain is **"MoltBot but security-first and privacy-focused"**

Perfect for:
- Security-conscious users
- Privacy advocates
- Compliance requirements
- Single-user automation
- Self-hosted environments

### Technology Choices

**Why TypeScript + Node.js:**
- Strong typing for security
- Large ecosystem
- Easy to audit
- Cross-platform

**Why SQLite:**
- Local-first
- Zero configuration
- ACID transactions
- Perfect for single-user

**Why Telegram:**
- Easy bot API
- Great for automation
- Large user base
- Rich features

**Why Ollama:**
- 100% private
- No API costs
- Offline capable
- Multiple models

### Contributing

This is a reference implementation showing how to build a secure AI assistant. Contributions welcome!

**Priority areas:**
1. New tools (browser, cron, file write)
2. Skills system implementation
3. More LLM providers
4. Security improvements
5. Documentation

### License

MIT - Free to use, modify, and distribute.

### Links

- **GitHub:** https://github.com/BaAlvaro/dockbrain
- **Documentation:** See README.md, SECURITY.md, SETUP_LINUX.md, SETUP_WINDOWS.md
- **Issues:** https://github.com/BaAlvaro/dockbrain/issues

---

## Questions & Answers

**Q: Why not just use MoltBot?**
A: MoltBot is excellent for power users who want computer control. DockBrain focuses on security, auditability, and privacy. Different use cases.

**Q: Is it production-ready?**
A: It's MVP-ready for personal use. For production, consider adding backup/restore, monitoring, and more integrations.

**Q: How is it different from using Claude/ChatGPT with plugins?**
A: DockBrain is self-hosted, local-first, with granular permissions and audit logging. Your data never leaves your machine if you use Ollama.

**Q: Can it do X like MoltBot?**
A: Check the roadmap! Many MoltBot features are planned. The goal is security-first, not feature parity.

**Q: How secure is it really?**
A: Read SECURITY.md for the full threat model and mitigations. Every design decision prioritizes security.

---

**Built with ❤️ for privacy, security, and control.**

🚀 Star on GitHub: https://github.com/BaAlvaro/dockbrain
