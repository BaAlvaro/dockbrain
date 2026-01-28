# 📋 GitHub Issues - DockBrain Roadmap

## Cómo usar este documento

Copia cada issue a GitHub con:
1. El título como título del issue
2. El contenido como descripción
3. Los labels sugeridos
4. El milestone correspondiente

---

## 🔥 Sprint 1 - Quick Wins (Milestone: v0.2.0)

### Issue #1: [P0] Add file write/edit tool

**Labels:** `enhancement`, `priority: critical`, `good first issue`

**Description:**

Currently DockBrain only has `files_readonly` tool. We need write capabilities.

**Proposed solution:**

Create `src/tools/files-write/tool.ts` with actions:
- `write(path, content)` - Write file
- `append(path, content)` - Append to file
- `edit(path, old_string, new_string)` - Replace string in file
- `delete(path)` - Delete file

**Security requirements:**
- ✅ Granular permissions per action
- ✅ Path traversal protection (reuse from files_readonly)
- ✅ Confirmation prompt REQUIRED for write/delete
- ✅ Allow/deny path patterns in config
- ✅ File size limits
- ✅ Audit logging

**Acceptance criteria:**
- [ ] Tool implemented with all 4 actions
- [ ] Tests written (unit + integration)
- [ ] Documentation updated
- [ ] Permission system integrated
- [ ] Works with confirmation prompts

**Estimated effort:** 2-3 days

---

### Issue #2: [P0] Enhance system-exec tool with bash support

**Labels:** `enhancement`, `priority: critical`, `security`

**Description:**

Current `system_exec` tool is limited. Need full bash support with security allowlist.

**Proposed solution:**

Enhance `src/tools/system-exec/tool.ts`:
- Allowlist of safe commands in config
- Support for piped commands
- Environment variable control
- Timeout configuration
- Working directory control

**Security requirements:**
- ✅ Allowlist-based (deny by default)
- ✅ Block dangerous commands (rm -rf /, dd, etc.)
- ✅ Timeout enforcement (default 30s, max 5min)
- ✅ Resource limits (memory, CPU)
- ✅ Output size limits
- ✅ Audit logging

**Example allowlist:**
```yaml
tools:
  system_exec:
    allowed_commands:
      - ls
      - cat
      - grep
      - find
      - docker
      - git
      - npm
    elevated_commands: # Require confirmation
      - rm
      - mv
      - systemctl
```

**Acceptance criteria:**
- [ ] Allowlist system implemented
- [ ] Dangerous command blocking
- [ ] Timeout + resource limits
- [ ] Tests for security edge cases
- [ ] Documentation + security guide

**Estimated effort:** 2-3 days

---

### Issue #3: [P1] Implement persistent user memory system

**Labels:** `enhancement`, `priority: high`, `ux`

**Description:**

Users need context persistence between sessions. Implement MoltBot-style USER.md memory.

**Proposed solution:**

Create `src/core/memory/user-memory.ts`:
- USER.md file per user (stored in `data/users/{user_id}/USER.md`)
- Auto-update with key facts from conversations
- Memory search API
- Integration with agent context

**File structure:**
```
data/users/1/
  USER.md           # Main user profile
  memory/           # Long-term memories
    2026-01-28.md
    2026-01-27.md
```

**USER.md format:**
```markdown
# User Profile

## Basic Info
- Name: John Doe
- Telegram: @johndoe
- Paired: 2026-01-28

## Preferences
- Prefers concise responses
- Uses Ollama (llama3.2)
- Working directory: /home/john/projects

## Context
- Works on DockBrain project
- Uses Linux (Ubuntu 24.04)
- Primary language: Spanish

## Recent Topics
- Browser automation discussion
- File write tool requirements
```

**Features:**
- Auto-append important facts
- Search by keyword
- Date-based memory retrieval
- Manual memory add/edit/delete

**Acceptance criteria:**
- [ ] USER.md creation on first pairing
- [ ] Auto-update mechanism
- [ ] Memory search tool
- [ ] CLI commands for memory management
- [ ] Tests + documentation

**Estimated effort:** 2-3 days

---

### Issue #4: [P1] Replace reminders with cron-based task scheduler

**Labels:** `enhancement`, `priority: high`, `feature`

**Description:**

Current reminders tool is basic. Replace with full cron scheduler.

**Proposed solution:**

Create `src/tools/cron/tool.ts`:
- `node-cron` integration
- Persistent schedule storage in SQLite
- CRUD operations (create, list, update, delete)
- Cron syntax support
- One-time + recurring tasks

**Actions:**
- `schedule(cron, task, description)` - Schedule task
- `list()` - List all scheduled tasks
- `delete(id)` - Remove scheduled task
- `pause(id)` / `resume(id)` - Pause/resume task

**Database schema:**
```sql
CREATE TABLE scheduled_tasks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  cron_expression TEXT NOT NULL,
  task_description TEXT NOT NULL,
  next_run_at INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Example usage:**
```
Schedule "npm run backup" every day at 2am
List my scheduled tasks
Delete task #3
```

**Acceptance criteria:**
- [ ] node-cron integration
- [ ] SQLite persistence
- [ ] All CRUD operations
- [ ] Survives restarts
- [ ] Tests + documentation
- [ ] Migration from old reminders table

**Estimated effort:** 3-4 days

---

## 🌐 Sprint 2 - Browser Automation (Milestone: v0.3.0)

### Issue #5: [P0] Implement browser automation tool with Playwright

**Labels:** `enhancement`, `priority: critical`, `feature`

**Description:**

Add browser automation capabilities using Playwright for web scraping, testing, and UI automation.

**Proposed solution:**

Create `src/tools/browser/tool.ts` with Playwright integration.

**Actions:**
- `navigate(url)` - Navigate to URL
- `read()` - Read page content (text + HTML)
- `screenshot(path?)` - Take screenshot
- `click(selector)` - Click element
- `type(selector, text)` - Type in element
- `wait(selector, timeout?)` - Wait for element
- `execute(script)` - Execute JavaScript
- `pdf(path?)` - Generate PDF

**Security requirements:**
- Domain allowlist (like web_sandbox)
- Isolated browser profile
- Timeouts (page load, action, total)
- Resource limits (memory, CPU)
- No file system access from browser
- Confirmation for file downloads

**Configuration:**
```yaml
tools:
  browser:
    allowed_domains:
      - "*.wikipedia.org"
      - "github.com"
    timeout_page_load: 30000
    timeout_action: 10000
    timeout_total: 120000
    headless: true
    profile_dir: "./data/browser_profiles"
```

**Dependencies:**
```bash
npm install playwright
npx playwright install chromium
```

**Acceptance criteria:**
- [ ] Playwright integration
- [ ] All 8 actions implemented
- [ ] Domain allowlist working
- [ ] Timeout enforcement
- [ ] Isolated browser profile
- [ ] Screenshot + PDF generation
- [ ] Tests + documentation

**Estimated effort:** 1-2 weeks

---

## 🔧 Sprint 3 - Skills System (Milestone: v0.4.0)

### Issue #6: [P1] Implement skills system with SKILL.md format

**Labels:** `enhancement`, `priority: high`, `extensibility`

**Description:**

Add extensibility through skills system compatible with MoltBot's SKILL.md format.

**Proposed solution:**

Create skill loader system:
- Parse SKILL.md files with YAML frontmatter
- Load from multiple directories (precedence)
- Dynamic registration
- Skill matching based on context

**Directory structure:**
```
workspace/skills/          # Project-specific (highest priority)
~/.dockbrain/skills/       # User-installed
src/skills/bundled/        # Built-in skills (lowest priority)
```

**SKILL.md format:**
```markdown
---
name: git-helper
version: 1.0.0
author: DockBrain Team
description: Git operations helper
requires_tools:
  - system_exec
  - files_readonly
---

# Git Helper Skill

You are a Git expert. Help users with common Git operations.

## Common commands:
- git status
- git add
- git commit
- git push
- git pull

When user asks about Git, use system_exec to run commands.
Always explain what you're doing before executing.
```

**Implementation:**
```typescript
// src/core/skills/skill-loader.ts
class SkillLoader {
  loadSkills(directories: string[]): Skill[]
  parseSkill(content: string): Skill
  registerSkill(skill: Skill): void
  matchSkills(context: string): Skill[]
}
```

**Acceptance criteria:**
- [ ] YAML frontmatter parsing
- [ ] Multi-directory loading
- [ ] Precedence system
- [ ] Skill matching
- [ ] 5 bundled skills (git, docker, code-review, translate, summarize)
- [ ] Tests + documentation

**Estimated effort:** 2 weeks

---

### Issue #7: [P2] Create CLI for skills management

**Labels:** `enhancement`, `priority: medium`, `cli`

**Description:**

Add CLI commands to manage skills (install, list, search, remove).

**Proposed commands:**
```bash
dockbrain skill list                    # List installed skills
dockbrain skill search <query>          # Search bundled skills
dockbrain skill install <name>          # Install skill
dockbrain skill remove <name>           # Remove skill
dockbrain skill info <name>             # Show skill details
dockbrain skill create <name>           # Create new skill template
```

**Implementation:**
Create `src/cli/skills.ts` with Commander.js

**Acceptance criteria:**
- [ ] All 6 commands working
- [ ] Help text
- [ ] Error handling
- [ ] Tests + documentation

**Estimated effort:** 3-4 days

---

## 🤖 Sprint 4 - Multi-Agent (Milestone: v0.5.0)

### Issue #8: [P2] Implement multi-agent session system

**Labels:** `enhancement`, `priority: medium`, `architecture`

**Description:**

Add support for multiple concurrent agent sessions with inter-agent messaging.

**Proposed solution:**

Create `src/core/orchestrator/session-manager.ts`:
- Session creation/destruction
- Session isolation (separate context)
- Message routing between sessions
- Session lifecycle management

**Tools:**
- `sessions_list()` - List active sessions
- `sessions_spawn(name, model?)` - Create new session
- `sessions_send(session_id, message)` - Send to session
- `sessions_destroy(session_id)` - End session

**Database schema:**
```sql
CREATE TABLE agent_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  model TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Use cases:**
- Research session + summarization session
- Code review session + fix implementation session
- Long-running monitoring tasks

**Acceptance criteria:**
- [ ] Session manager implemented
- [ ] All 4 session tools
- [ ] Session isolation
- [ ] Message routing
- [ ] Tests + documentation

**Estimated effort:** 1-2 weeks

---

## 🎨 Sprint 5 - Media & Polish (Milestone: v0.6.0)

### Issue #9: [P2] Add media handling (images, audio, files)

**Labels:** `enhancement`, `priority: medium`, `feature`

**Description:**

Add support for receiving and sending media through Telegram.

**Features:**
- Receive images, audio, documents
- Store in `data/media/{user_id}/`
- Process images (resize, compress)
- Generate images (optional)
- Send media back to user

**Acceptance criteria:**
- [ ] Media upload/download
- [ ] Storage management
- [ ] Image processing basics
- [ ] Tests + documentation

**Estimated effort:** 1 week

---

### Issue #10: [P3] Add WhatsApp connector

**Labels:** `enhancement`, `priority: low`, `connector`

**Description:**

Add WhatsApp support as second messaging platform.

**Implementation:**
Use `whatsapp-web.js` or similar library.

**Acceptance criteria:**
- [ ] WhatsApp connector working
- [ ] Same tools as Telegram
- [ ] Documentation

**Estimated effort:** 1-2 weeks

**Note:** Post v1.0 feature

---

## 🐛 Bug Fixes & Improvements

### Issue #11: [Bug] Improve error handling in task executor

**Labels:** `bug`, `priority: medium`

**Description:**

Some errors in task execution are not caught properly, causing crashes.

**Steps to reproduce:**
1. Grant file read permission
2. Try to read non-existent file
3. Bot crashes instead of graceful error

**Expected:** Graceful error message to user
**Actual:** Crash

**Acceptance criteria:**
- [ ] All try-catch blocks reviewed
- [ ] Proper error messages to user
- [ ] No crashes on user errors
- [ ] Tests for error cases

---

### Issue #12: [Enhancement] Add rate limiting per tool

**Labels:** `enhancement`, `security`, `priority: medium`

**Description:**

Currently rate limiting is global per user. Add per-tool rate limiting.

**Example:**
```yaml
rate_limits:
  global: 20/minute
  per_tool:
    web_sandbox: 10/minute
    system_exec: 5/minute
    browser: 3/minute
```

**Acceptance criteria:**
- [ ] Per-tool rate limits in config
- [ ] Rate limiter respects tool limits
- [ ] Tests + documentation

---

## 📚 Documentation

### Issue #13: [Docs] Create video tutorial for installation

**Labels:** `documentation`, `priority: medium`

**Description:**

Create 5-10 minute video showing:
1. Installation on Linux
2. Telegram bot creation
3. Pairing process
4. Basic usage examples
5. Permission management

Upload to YouTube and link from README.

---

### Issue #14: [Docs] Write comparison guide: DockBrain vs MoltBot

**Labels:** `documentation`, `priority: high`

**Description:**

Create comprehensive comparison guide explaining:
- When to use DockBrain vs MoltBot
- Feature differences
- Security model differences
- Use case recommendations

**Note:** COMPARISON_MOLTBOT.md already created, just needs polish.

---

## 🎯 Milestone Planning

### v0.2.0 - Quick Wins (2 weeks)
- #1 File write tool
- #2 Shell execution
- #3 User memory
- #4 Cron scheduler

### v0.3.0 - Browser (2 weeks)
- #5 Browser automation

### v0.4.0 - Skills (2 weeks)
- #6 Skills system
- #7 Skills CLI

### v0.5.0 - Multi-Agent (2 weeks)
- #8 Multi-agent sessions

### v0.6.0 - Media (1 week)
- #9 Media handling
- #11 Error handling improvements
- #12 Per-tool rate limiting

### v1.0.0 - Production Ready (1 week polish)
- All tests passing
- Documentation complete
- Security audit
- Performance optimization

**Total timeline:** ~10 weeks (2.5 months) to v1.0.0

---

## 🏷️ Label Definitions

**Priority:**
- `priority: critical` (P0) - Must have for next release
- `priority: high` (P1) - Should have
- `priority: medium` (P2) - Nice to have
- `priority: low` (P3) - Future

**Type:**
- `bug` - Something broken
- `enhancement` - New feature
- `documentation` - Docs only
- `security` - Security related
- `performance` - Performance optimization

**Difficulty:**
- `good first issue` - Easy for newcomers
- `intermediate` - Requires codebase knowledge
- `advanced` - Complex, needs architecture understanding

**Area:**
- `feature` - New functionality
- `cli` - CLI changes
- `connector` - Messaging platform
- `tool` - Tool implementation
- `architecture` - Core architecture
- `ux` - User experience
- `extensibility` - Plugin/skill system

---

## 📊 Project Board Columns

1. **Backlog** - Not yet prioritized
2. **Ready** - Prioritized, ready to work
3. **In Progress** - Currently being worked on
4. **Review** - PR submitted, needs review
5. **Done** - Merged and released

---

**Next step:** Copy these issues to GitHub and start Sprint 1! 🚀
