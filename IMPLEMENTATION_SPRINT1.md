# 🔥 Sprint 1 - Implementación Técnica (2 Semanas)

## Objetivo: Feature Parity con MoltBot

**Timeline:** 14 días
**Resultado:** DockBrain = MoltBot en features core

---

## 🎯 Features a Implementar

### 1. Browser Automation (Días 1-5)
### 2. File Write/Edit (Días 3-5)
### 3. Shell Execution Completo (Días 6-7)
### 4. Memory System (Días 8-10)
### 5. Multi-Agent Básico (Días 11-14)

---

## 📦 Día 1-5: Browser Automation

### Dependencias
```bash
npm install playwright
npm install @types/playwright
npx playwright install chromium
```

### Estructura
```
src/tools/browser/
├── tool.ts                 # Main tool
├── browser-manager.ts      # Singleton browser instance
├── page-controller.ts      # Page operations
├── types.ts               # TypeScript types
└── README.md              # Documentation
```

### Implementación

#### `src/tools/browser/browser-manager.ts`
```typescript
import { chromium, Browser, BrowserContext } from 'playwright';
import { Logger } from '../../utils/logger';

export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  private constructor(private logger: Logger) {}

  static getInstance(logger: Logger): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager(logger);
    }
    return BrowserManager.instance;
  }

  async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.logger.info('Browser launched');
    }
    return this.browser;
  }

  async getContext(userId: number): Promise<BrowserContext> {
    const contextId = `user_${userId}`;

    if (!this.contexts.has(contextId)) {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: 'DockBrain/1.0',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
      });
      this.contexts.set(contextId, context);
      this.logger.info({ userId }, 'Browser context created');
    }

    return this.contexts.get(contextId)!;
  }

  async closeContext(userId: number): Promise<void> {
    const contextId = `user_${userId}`;
    const context = this.contexts.get(contextId);
    if (context) {
      await context.close();
      this.contexts.delete(contextId);
      this.logger.info({ userId }, 'Browser context closed');
    }
  }

  async close(): Promise<void> {
    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('Browser closed');
    }
  }
}
```

#### `src/tools/browser/tool.ts`
```typescript
import { z } from 'zod';
import { BaseTool } from '../base-tool';
import { ToolContext } from '../../types/tool';
import { BrowserManager } from './browser-manager';

export class BrowserTool extends BaseTool {
  private browserManager: BrowserManager;

  constructor(logger: any, config: any) {
    super(logger, config);
    this.browserManager = BrowserManager.getInstance(logger);
  }

  getName(): string {
    return 'browser';
  }

  getDescription(): string {
    return 'Control web browser for automation, scraping, and testing';
  }

  getActions() {
    return {
      navigate: {
        description: 'Navigate to a URL',
        parameters: z.object({
          url: z.string().url(),
          wait_until: z.enum(['load', 'domcontentloaded', 'networkidle']).default('load'),
        }),
      },
      read: {
        description: 'Read page content (text and HTML)',
        parameters: z.object({
          selector: z.string().optional(),
        }),
      },
      screenshot: {
        description: 'Take screenshot of page',
        parameters: z.object({
          full_page: z.boolean().default(false),
          path: z.string().optional(),
        }),
      },
      click: {
        description: 'Click an element',
        parameters: z.object({
          selector: z.string(),
          timeout: z.number().default(5000),
        }),
      },
      type: {
        description: 'Type text into an element',
        parameters: z.object({
          selector: z.string(),
          text: z.string(),
          delay: z.number().default(0),
        }),
      },
      wait: {
        description: 'Wait for element or timeout',
        parameters: z.object({
          selector: z.string().optional(),
          timeout: z.number().default(30000),
        }),
      },
      execute: {
        description: 'Execute JavaScript in page context',
        parameters: z.object({
          script: z.string(),
        }),
      },
      pdf: {
        description: 'Generate PDF of page',
        parameters: z.object({
          path: z.string().optional(),
          format: z.enum(['A4', 'Letter', 'Legal']).default('A4'),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    context: ToolContext
  ): Promise<any> {
    const browserContext = await this.browserManager.getContext(context.user.id);
    const page = await browserContext.newPage();

    try {
      switch (action) {
        case 'navigate':
          await page.goto(params.url, { waitUntil: params.wait_until });
          return { success: true, url: page.url(), title: await page.title() };

        case 'read':
          if (params.selector) {
            const element = await page.locator(params.selector);
            const text = await element.textContent();
            return { text };
          } else {
            const text = await page.textContent('body');
            const html = await page.content();
            return { text, html };
          }

        case 'screenshot':
          const screenshotBuffer = await page.screenshot({
            fullPage: params.full_page,
            path: params.path,
          });
          return {
            success: true,
            path: params.path,
            size: screenshotBuffer.length,
          };

        case 'click':
          await page.click(params.selector, { timeout: params.timeout });
          return { success: true };

        case 'type':
          await page.type(params.selector, params.text, { delay: params.delay });
          return { success: true };

        case 'wait':
          if (params.selector) {
            await page.waitForSelector(params.selector, { timeout: params.timeout });
          } else {
            await page.waitForTimeout(params.timeout);
          }
          return { success: true };

        case 'execute':
          const result = await page.evaluate(params.script);
          return { result };

        case 'pdf':
          const pdfBuffer = await page.pdf({
            path: params.path,
            format: params.format,
          });
          return {
            success: true,
            path: params.path,
            size: pdfBuffer.length,
          };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } finally {
      await page.close();
    }
  }
}
```

### Tests
```typescript
// tests/tools/browser.test.ts
describe('BrowserTool', () => {
  it('should navigate to URL', async () => {
    // Test implementation
  });

  it('should read page content', async () => {
    // Test implementation
  });

  it('should take screenshot', async () => {
    // Test implementation
  });
});
```

---

## 📦 Día 3-5: File Write/Edit

### Estructura
```
src/tools/files-write/
├── tool.ts
├── file-operations.ts
├── backup-manager.ts
└── README.md
```

### Implementación

#### `src/tools/files-write/tool.ts`
```typescript
import { z } from 'zod';
import { BaseTool } from '../base-tool';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FilesWriteTool extends BaseTool {
  getName(): string {
    return 'files_write';
  }

  getActions() {
    return {
      write: {
        description: 'Write content to a file',
        parameters: z.object({
          path: z.string(),
          content: z.string(),
          create_dirs: z.boolean().default(true),
        }),
        requiresConfirmation: true,
      },
      append: {
        description: 'Append content to a file',
        parameters: z.object({
          path: z.string(),
          content: z.string(),
        }),
      },
      edit: {
        description: 'Edit file by replacing text',
        parameters: z.object({
          path: z.string(),
          old_text: z.string(),
          new_text: z.string(),
          replace_all: z.boolean().default(false),
        }),
        requiresConfirmation: true,
      },
      delete: {
        description: 'Delete a file',
        parameters: z.object({
          path: z.string(),
        }),
        requiresConfirmation: true,
      },
    };
  }

  protected async executeAction(action: string, params: any, context: any) {
    const safePath = this.validatePath(params.path);

    switch (action) {
      case 'write':
        if (params.create_dirs) {
          await fs.mkdir(path.dirname(safePath), { recursive: true });
        }
        await fs.writeFile(safePath, params.content, 'utf-8');
        return { success: true, path: safePath, size: params.content.length };

      case 'append':
        await fs.appendFile(safePath, params.content, 'utf-8');
        return { success: true, path: safePath };

      case 'edit':
        const content = await fs.readFile(safePath, 'utf-8');
        let newContent: string;

        if (params.replace_all) {
          newContent = content.replaceAll(params.old_text, params.new_text);
        } else {
          newContent = content.replace(params.old_text, params.new_text);
        }

        await fs.writeFile(safePath, newContent, 'utf-8');
        return { success: true, path: safePath, replacements: 1 };

      case 'delete':
        await fs.unlink(safePath);
        return { success: true, path: safePath };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private validatePath(filePath: string): string {
    // Path traversal protection
    const safeRoot = this.config.safe_root_dir || './data/safe_root';
    const resolved = path.resolve(safeRoot, filePath);

    if (!resolved.startsWith(path.resolve(safeRoot))) {
      throw new Error('Path traversal detected');
    }

    return resolved;
  }
}
```

---

## 📦 Día 6-7: Shell Execution Completo

### Implementación

#### `src/tools/system-exec/tool.ts` (mejorado)
```typescript
import { z } from 'zod';
import { BaseTool } from '../base-tool';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SystemExecTool extends BaseTool {
  getName(): string {
    return 'system_exec';
  }

  getActions() {
    return {
      execute: {
        description: 'Execute shell command',
        parameters: z.object({
          command: z.string(),
          cwd: z.string().optional(),
          timeout: z.number().default(30000),
          env: z.record(z.string()).optional(),
        }),
      },
      bash: {
        description: 'Execute bash script',
        parameters: z.object({
          script: z.string(),
          timeout: z.number().default(60000),
        }),
        requiresConfirmation: true,
      },
    };
  }

  protected async executeAction(action: string, params: any, context: any) {
    // Allowlist check
    if (!this.isCommandAllowed(params.command || params.script)) {
      throw new Error('Command not allowed by allowlist');
    }

    const options = {
      cwd: params.cwd,
      timeout: params.timeout,
      env: { ...process.env, ...params.env },
      maxBuffer: 1024 * 1024 * 10, // 10MB
    };

    try {
      const { stdout, stderr } = await execAsync(
        params.command || params.script,
        options
      );

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exit_code: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
        exit_code: error.code || 1,
      };
    }
  }

  private isCommandAllowed(command: string): boolean {
    const allowlist = this.config.allowed_commands || [
      'ls', 'cat', 'grep', 'find', 'git', 'npm', 'node', 'docker',
    ];

    const firstWord = command.trim().split(/\s+/)[0];

    // Check allowlist
    if (!allowlist.includes(firstWord)) {
      return false;
    }

    // Block dangerous patterns
    const dangerous = [
      /rm\s+-rf\s+\//,
      /dd\s+if=/,
      /mkfs/,
      /:\(\)\{.*\}/,  // fork bomb
    ];

    for (const pattern of dangerous) {
      if (pattern.test(command)) {
        return false;
      }
    }

    return true;
  }
}
```

---

## 📦 Día 8-10: Memory System

### Estructura
```
src/core/memory/
├── user-memory.ts
├── memory-manager.ts
├── types.ts
└── README.md
```

### Implementación

#### `src/core/memory/user-memory.ts`
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger';

interface UserMemory {
  userId: number;
  profile: {
    name?: string;
    telegram?: string;
    preferences: Record<string, any>;
    context: string[];
  };
  memories: Memory[];
}

interface Memory {
  id: string;
  timestamp: number;
  category: 'fact' | 'preference' | 'context';
  content: string;
  relevance: number;
}

export class UserMemoryManager {
  constructor(private logger: Logger, private dataDir: string) {}

  async getUserMemory(userId: number): Promise<UserMemory> {
    const memoryPath = this.getMemoryPath(userId);

    try {
      const content = await fs.readFile(memoryPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Create new memory
      return this.createUserMemory(userId);
    }
  }

  async updateProfile(userId: number, updates: Partial<UserMemory['profile']>): Promise<void> {
    const memory = await this.getUserMemory(userId);
    memory.profile = { ...memory.profile, ...updates };
    await this.saveMemory(userId, memory);
  }

  async addMemory(userId: number, memory: Omit<Memory, 'id' | 'timestamp'>): Promise<void> {
    const userMemory = await this.getUserMemory(userId);

    userMemory.memories.push({
      ...memory,
      id: this.generateId(),
      timestamp: Date.now(),
    });

    // Keep only last 100 memories
    if (userMemory.memories.length > 100) {
      userMemory.memories = userMemory.memories.slice(-100);
    }

    await this.saveMemory(userId, userMemory);
  }

  async searchMemories(userId: number, query: string): Promise<Memory[]> {
    const memory = await this.getUserMemory(userId);

    // Simple keyword search (TODO: upgrade to vector search)
    const keywords = query.toLowerCase().split(/\s+/);

    return memory.memories.filter(m =>
      keywords.some(keyword => m.content.toLowerCase().includes(keyword))
    ).sort((a, b) => b.relevance - a.relevance);
  }

  private async createUserMemory(userId: number): Promise<UserMemory> {
    const memory: UserMemory = {
      userId,
      profile: {
        preferences: {},
        context: [],
      },
      memories: [],
    };

    await this.saveMemory(userId, memory);
    return memory;
  }

  private async saveMemory(userId: number, memory: UserMemory): Promise<void> {
    const memoryPath = this.getMemoryPath(userId);
    await fs.mkdir(path.dirname(memoryPath), { recursive: true });
    await fs.writeFile(memoryPath, JSON.stringify(memory, null, 2), 'utf-8');
  }

  private getMemoryPath(userId: number): string {
    return path.join(this.dataDir, `users/${userId}/memory.json`);
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Memory Tool
```typescript
// src/tools/memory/tool.ts
export class MemoryTool extends BaseTool {
  getName(): string {
    return 'memory';
  }

  getActions() {
    return {
      search: {
        description: 'Search user memories',
        parameters: z.object({
          query: z.string(),
        }),
      },
      add: {
        description: 'Add new memory',
        parameters: z.object({
          content: z.string(),
          category: z.enum(['fact', 'preference', 'context']),
        }),
      },
    };
  }

  // Implementation...
}
```

---

## 📦 Día 11-14: Multi-Agent Básico

### Estructura
```
src/core/orchestrator/
├── session-manager.ts
├── agent-session.ts
├── message-router.ts
└── README.md
```

### Implementación

#### `src/core/orchestrator/session-manager.ts`
```typescript
import { Logger } from '../../utils/logger';
import { AgentSession } from './agent-session';

export class SessionManager {
  private sessions: Map<string, AgentSession> = new Map();

  constructor(private logger: Logger) {}

  async createSession(
    userId: number,
    name: string,
    model?: string
  ): Promise<string> {
    const sessionId = this.generateSessionId();

    const session = new AgentSession(sessionId, userId, name, model, this.logger);
    this.sessions.set(sessionId, session);

    this.logger.info({ sessionId, userId, name }, 'Session created');

    return sessionId;
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(userId: number): AgentSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId);
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.cleanup();
      this.sessions.delete(sessionId);
      this.logger.info({ sessionId }, 'Session destroyed');
    }
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Session Tool
```typescript
// src/tools/sessions/tool.ts
export class SessionsTool extends BaseTool {
  getName(): string {
    return 'sessions';
  }

  getActions() {
    return {
      spawn: {
        description: 'Create new agent session',
        parameters: z.object({
          name: z.string(),
          model: z.string().optional(),
        }),
      },
      list: {
        description: 'List active sessions',
        parameters: z.object({}),
      },
      send: {
        description: 'Send message to session',
        parameters: z.object({
          session_id: z.string(),
          message: z.string(),
        }),
      },
      destroy: {
        description: 'Destroy session',
        parameters: z.object({
          session_id: z.string(),
        }),
      },
    };
  }

  // Implementation...
}
```

---

## 📋 Checklist de Implementación

### Semana 1 (Días 1-7)
- [ ] Day 1: Setup Playwright + estructura browser tool
- [ ] Day 2: Implementar navegación + lectura
- [ ] Day 3: Implementar screenshot + PDF + tests
- [ ] Day 4: Implementar click + type + execute
- [ ] Day 5: Files write tool completo + tests
- [ ] Day 6: Shell execution mejorado
- [ ] Day 7: Tests + documentación browser + files + shell

### Semana 2 (Días 8-14)
- [ ] Day 8: Memory manager básico
- [ ] Day 9: Memory tool + integración
- [ ] Day 10: Tests memoria + documentación
- [ ] Day 11: Session manager básico
- [ ] Day 12: Sessions tool completo
- [ ] Day 13: Tests sessions + integración
- [ ] Day 14: Release v0.3.0 + docs + announcement

---

## 🚀 Release v0.3.0 "Feature Parity"

### Changelog
```markdown
# v0.3.0 - Feature Parity with MoltBot

## 🎉 New Features

### Browser Automation
- Navigate to URLs
- Read page content
- Take screenshots
- Generate PDFs
- Click elements
- Type text
- Execute JavaScript
- Wait for elements

### File Operations
- Write files
- Append to files
- Edit files (string replacement)
- Delete files
- Atomic operations
- Backup before edit

### Shell Execution
- Full bash support
- Allowlist-based security
- Resource limits
- Timeout enforcement

### Memory System
- Persistent user profiles
- Memory search
- Categorized memories
- Auto-pruning

### Multi-Agent (Beta)
- Session spawning
- Inter-session messaging
- Session management
- Isolated contexts

## 🐛 Bug Fixes
- Fixed path traversal vulnerability
- Improved error handling
- Better timeout management

## 📝 Documentation
- Browser automation guide
- File operations guide
- Memory system guide
- Multi-agent tutorial

## 🚀 What's Next
- RAG system (v0.4.0)
- Database connectors (v0.4.0)
- Visual workflows (v0.5.0)
```

---

## 📊 Success Metrics

### Code Quality
- [ ] 90%+ test coverage
- [ ] All tests passing
- [ ] No security vulnerabilities
- [ ] TypeScript strict mode
- [ ] ESLint passing

### Documentation
- [ ] README actualizado
- [ ] API docs completos
- [ ] Tutoriales para cada feature
- [ ] Video demo

### Performance
- [ ] Browser tool < 2s response time
- [ ] File operations < 100ms
- [ ] Memory search < 50ms
- [ ] Session spawn < 500ms

---

## 🎯 Announcement Strategy

### Blog Post: "DockBrain catches up to MoltBot"
```markdown
# DockBrain v0.3.0: Feature Parity with MoltBot

After 2 weeks of intense development, DockBrain now matches MoltBot's core features:

✅ Browser automation (Playwright)
✅ File write/edit operations
✅ Full bash execution
✅ Persistent memory system
✅ Multi-agent sessions

But we're not stopping here. Next sprint:
- RAG for document search
- Database integrations
- Visual workflows

[Read more...](blog link)
```

### Show HN Post
```
DockBrain v0.3.0 – AI assistant with browser automation, multi-agent, and more

We've been working on an open-source AI assistant that's catching up to MoltBot.

v0.3.0 adds:
- Browser automation (Playwright/CDP)
- File operations (read/write/edit)
- Persistent memory
- Multi-agent sessions

Coming next:
- RAG system
- Database connectors
- Visual workflow builder

GitHub: https://github.com/BaAlvaro/dockbrain
Demo video: [link]

Feedback welcome!
```

---

**Let's ship this. 2 semanas. Feature parity. Go. 🚀**
