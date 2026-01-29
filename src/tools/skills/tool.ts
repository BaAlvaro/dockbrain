import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolExecutionResult } from '../../types/tool.js';
import type { Logger } from '../../utils/logger.js';
import type { LoadedSkill } from '../../core/skills/skill-types.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class SkillsTool extends BaseTool {
  private skills: LoadedSkill[];

  constructor(logger: Logger, skills: LoadedSkill[]) {
    super(logger);
    this.skills = skills;
  }

  getName(): string {
    return 'skills';
  }

  getDescription(): string {
    return 'List and run local skills from SKILL.md definitions';
  }

  getActions() {
    return {
      list: {
        description: 'List available skills',
        parameters: z.object({}),
      },
      run: {
        description: 'Run a skill command by id',
        parameters: z.object({
          id: z.string().min(1),
          args: z.array(z.string()).optional().default([]),
        }),
      },
    };
  }

  protected async executeAction(
    action: string,
    params: any,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    switch (action) {
      case 'list':
        return this.listSkills();
      case 'run':
        return this.runSkill(params.id, params.args);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private listSkills(): ToolExecutionResult {
    return {
      success: true,
      data: {
        skills: this.skills.map((skill) => ({
          id: skill.manifest.id,
          name: skill.manifest.name,
          description: skill.manifest.description,
        })),
      },
    };
  }

  private async runSkill(id: string, args: string[]): Promise<ToolExecutionResult> {
    const skill = this.skills.find((s) => s.manifest.id === id);
    if (!skill) {
      return { success: false, error: `Skill "${id}" not found` };
    }

    if (!skill.manifest.command) {
      return { success: false, error: `Skill "${id}" has no command configured` };
    }

    const commandArgs = [...(skill.manifest.args || []), ...args];
    const cwd = skill.manifest.working_dir;

    try {
      const { stdout, stderr } = await execFileAsync(skill.manifest.command, commandArgs, {
        cwd,
        timeout: 20000,
        maxBuffer: 1024 * 1024,
      });

      return {
        success: true,
        data: {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Skill execution failed',
      };
    }
  }
}
