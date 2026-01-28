export type MemoryCategory = 'fact' | 'preference' | 'context';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  category: MemoryCategory;
  content: string;
  relevance: number;
}

export interface UserMemoryProfile {
  name?: string;
  telegram?: string;
  preferences: Record<string, any>;
  context: string[];
}

export interface UserMemory {
  userId: number;
  profile: UserMemoryProfile;
  memories: MemoryEntry[];
}
