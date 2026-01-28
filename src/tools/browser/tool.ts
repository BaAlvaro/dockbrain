import { z } from 'zod';
import path from 'path';
import { promises as fs } from 'fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import { InputSanitizer } from '../../core/security/input-sanitizer.js';

const MAX_CONTENT_LENGTH = 50000;
const MAX_FIELDS = 25;
const MAX_SELECTORS = 25;

export class BrowserTool extends BaseTool {
  private sanitizer: InputSanitizer;
  private browser: Browser | null = null;

  constructor(
    logger: Logger,
    private allowedDomains: string[],
    private maxTimeoutMs: number,
    private screenshotDir: string
  ) {
    super(logger);
    this.sanitizer = new InputSanitizer(logger);
  }

  getName(): string {
    return 'browser';
  }

  getDescription(): string {
    return 'Browser automation for interactive web tasks';
  }

  getActions() {
    return {
      navigate: {
        description: 'Navigate to a URL and return page content',
        parameters: z.object({
          url: z.string().url(),
          wait_for_selector: z.string().optional(),
        }),
      },
      screenshot: {
        description: 'Take a screenshot of a web page',
        parameters: z.object({
          url: z.string().url(),
          full_page: z.boolean().optional().default(false),
          wait_for_selector: z.string().optional(),
        }),
      },
      fill_form: {
        description: 'Fill and optionally submit a web form',
        parameters: z.object({
          url: z.string().url(),
          fields: z
            .array(
              z.object({
                selector: z.string().min(1),
                value: z.string().min(1),
              })
            )
            .max(MAX_FIELDS),
          submit_selector: z.string().optional(),
        }),
      },
      click: {
        description: 'Click an element on a page',
        parameters: z.object({
          url: z.string().url(),
          selector: z.string().min(1),
          wait_after_click_ms: z.number().int().min(0).max(30000).optional().default(1000),
        }),
      },
      extract_data: {
        description: 'Extract data from a page using CSS selectors',
        parameters: z.object({
          url: z.string().url(),
          selectors: z.record(z.string()).refine((record) => Object.keys(record).length <= MAX_SELECTORS, {
            message: `Too many selectors (max ${MAX_SELECTORS})`,
          }),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const sanitizedUrl = this.sanitizer.sanitizeUrl(params.url);
    if (!sanitizedUrl) {
      return { success: false, error: 'Invalid URL format' };
    }

    const urlObj = new URL(sanitizedUrl);
    if (this.sanitizer.isPrivateIp(urlObj.hostname)) {
      return { success: false, error: 'Access to private IP addresses is forbidden' };
    }

    if (!this.isAllowedDomain(urlObj.hostname)) {
      return { success: false, error: `Domain ${urlObj.hostname} is not in allowlist` };
    }

    try {
      await this.ensureBrowser();

      switch (action) {
        case 'navigate':
          return await this.navigate(params.url, params.wait_for_selector);
        case 'screenshot':
          return await this.screenshot(params.url, params.full_page, params.wait_for_selector);
        case 'fill_form':
          return await this.fillForm(params.url, params.fields, params.submit_selector);
        case 'click':
          return await this.click(params.url, params.selector, params.wait_after_click_ms);
        case 'extract_data':
          return await this.extractData(params.url, params.selectors);
        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (error: any) {
      this.logger.error({ error, action }, 'Browser tool action failed');
      return { success: false, error: error.message || 'Browser action failed' };
    }
  }

  private async ensureBrowser(): Promise<void> {
    if (this.browser) return;
    await this.ensurePuppeteerConfigDir();
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  private async ensurePuppeteerConfigDir(): Promise<void> {
    if (!process.env.XDG_CONFIG_HOME) {
      process.env.XDG_CONFIG_HOME = path.join(process.cwd(), 'data', 'xdg');
    }

    const configDir = path.join(process.env.XDG_CONFIG_HOME, 'puppeteer');
    try {
      await fs.mkdir(configDir, { recursive: true });
    } catch (error: any) {
      this.logger.warn({ error, configDir }, 'Failed to create puppeteer config dir');
    }
  }

  private async navigate(url: string, waitForSelector?: string): Promise<ToolExecutionResult> {
    const page = await this.newPage();
    try {
      await page.goto(url, { timeout: this.maxTimeoutMs, waitUntil: 'networkidle2' });
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: this.maxTimeoutMs });
      }
      const title = await page.title();
      const content = await page.content();
      return {
        success: true,
        data: {
          url: page.url(),
          title,
          content: content.substring(0, MAX_CONTENT_LENGTH),
        },
      };
    } finally {
      await page.close();
    }
  }

  private async screenshot(
    url: string,
    fullPage: boolean,
    waitForSelector?: string
  ): Promise<ToolExecutionResult> {
    const page = await this.newPage();
    try {
      await page.goto(url, { timeout: this.maxTimeoutMs, waitUntil: 'networkidle2' });
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: this.maxTimeoutMs });
      }

      await fs.mkdir(this.screenshotDir, { recursive: true });
      const filename = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      await page.screenshot({ path: filepath, fullPage });

      return {
        success: true,
        data: {
          url: page.url(),
          screenshot_path: filepath,
          filename,
        },
      };
    } finally {
      await page.close();
    }
  }

  private async fillForm(
    url: string,
    fields: Array<{ selector: string; value: string }>,
    submitSelector?: string
  ): Promise<ToolExecutionResult> {
    const page = await this.newPage();
    try {
      await page.goto(url, { timeout: this.maxTimeoutMs, waitUntil: 'networkidle2' });
      for (const field of fields) {
        const sanitizedValue = this.sanitizer.sanitizeText(field.value, 2000);
        await page.waitForSelector(field.selector, { timeout: this.maxTimeoutMs });
        await page.type(field.selector, sanitizedValue);
      }

      if (submitSelector) {
        await page.click(submitSelector);
        await page.waitForNavigation({ timeout: this.maxTimeoutMs });
      }

      return {
        success: true,
        data: {
          final_url: page.url(),
          message: 'Form filled successfully',
        },
      };
    } finally {
      await page.close();
    }
  }

  private async click(
    url: string,
    selector: string,
    waitAfterClickMs: number
  ): Promise<ToolExecutionResult> {
    const page = await this.newPage();
    try {
      await page.goto(url, { timeout: this.maxTimeoutMs, waitUntil: 'networkidle2' });
      await page.waitForSelector(selector, { timeout: this.maxTimeoutMs });
      await page.click(selector);
      if (waitAfterClickMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitAfterClickMs));
      }

      return {
        success: true,
        data: {
          final_url: page.url(),
          message: 'Click executed successfully',
        },
      };
    } finally {
      await page.close();
    }
  }

  private async extractData(
    url: string,
    selectors: Record<string, string>
  ): Promise<ToolExecutionResult> {
    const page = await this.newPage();
    try {
      await page.goto(url, { timeout: this.maxTimeoutMs, waitUntil: 'networkidle2' });

      const data: Record<string, string | string[] | null> = {};

      for (const [key, selector] of Object.entries(selectors)) {
        try {
          const elements = await page.$$(selector);
          if (elements.length === 0) {
            data[key] = null;
          } else if (elements.length === 1) {
            data[key] = await elements[0].evaluate((el) => el.textContent?.trim() || '');
          } else {
            data[key] = await Promise.all(
              elements.map((el) => el.evaluate((node) => node.textContent?.trim() || ''))
            );
          }
        } catch {
          data[key] = null;
        }
      }

      return {
        success: true,
        data: {
          url: page.url(),
          extracted_data: data,
        },
      };
    } finally {
      await page.close();
    }
  }

  private isAllowedDomain(hostname: string): boolean {
    if (this.allowedDomains.includes('*')) return true;
    return this.sanitizer.validateDomain(hostname, this.allowedDomains);
  }

  private async newPage(): Promise<Page> {
    if (!this.browser) {
      await this.ensureBrowser();
    }
    return this.browser!.newPage();
  }
}
