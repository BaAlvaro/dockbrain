export type SkillPermission = string;

export interface SkillManifest {
  id: string;
  name: string;
  description?: string;
  permissions?: SkillPermission[];
  command?: string;
  args?: string[];
  working_dir?: string;
}

export interface LoadedSkill {
  manifest: SkillManifest;
  sourcePath: string;
  body?: string;
}
