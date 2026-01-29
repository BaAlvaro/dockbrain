import { promises as fs } from 'fs';
import path from 'path';
import type { Logger } from '../../utils/logger.js';
import type { LoadedSkill, SkillManifest } from './skill-types.js';

const FRONT_MATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

function parseYamlFrontMatter(raw: string): SkillManifest | null {
  const match = raw.match(FRONT_MATTER_RE);
  if (!match) return null;
  const lines = match[1].split('\n');
  const data: Record<string, any> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split(':');
    if (!key || rest.length === 0) continue;
    const value = rest.join(':').trim();
    data[key.trim()] = value;
  }

  const id = data.id || data.name;
  if (!id) return null;

  const permissions = data.permissions
    ? String(data.permissions)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : undefined;

  const args = data.args
    ? String(data.args)
        .split(' ')
        .map((p) => p.trim())
        .filter(Boolean)
    : undefined;

  return {
    id: String(id),
    name: String(data.name || id),
    description: data.description ? String(data.description) : undefined,
    permissions,
    command: data.command ? String(data.command) : undefined,
    args,
    working_dir: data.working_dir ? String(data.working_dir) : undefined,
  };
}

export class SkillLoader {
  constructor(private logger: Logger, private skillsDir: string) {}

  async loadAll(): Promise<LoadedSkill[]> {
    const entries = await this.safeReadDir(this.skillsDir);
    const skills: LoadedSkill[] = [];

    for (const entry of entries) {
      const skillDir = path.join(this.skillsDir, entry);
      const stat = await this.safeStat(skillDir);
      if (!stat?.isDirectory()) continue;

      const skillFile = path.join(skillDir, 'SKILL.md');
      const raw = await this.safeReadFile(skillFile);
      if (!raw) continue;

      const manifest = parseYamlFrontMatter(raw);
      if (!manifest) continue;

      skills.push({
        manifest,
        sourcePath: skillFile,
        body: raw.replace(FRONT_MATTER_RE, '').trim(),
      });
    }

    this.logger.info({ count: skills.length }, 'Loaded skills');
    return skills;
  }

  private async safeReadDir(dir: string): Promise<string[]> {
    try {
      return await fs.readdir(dir);
    } catch (error) {
      this.logger.warn({ error, dir }, 'Failed to read skills directory');
      return [];
    }
  }

  private async safeReadFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      this.logger.warn({ error, filePath }, 'Failed to read skill file');
      return null;
    }
  }

  private async safeStat(filePath: string): Promise<import('fs').Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }
}
