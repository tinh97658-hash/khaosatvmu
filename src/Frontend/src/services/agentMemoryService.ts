export interface MemorySaveRequest {
  content: string;
  tags?: string[];
  category?: string;
}

export interface MemoryRecallRequest {
  query: string;
  limit?: number;
}

export interface MemoryResult {
  id: string;
  content: string;
  score: number;
  tags?: string[];
}

const AGENT_MEMORY_URL = import.meta.env.VITE_AGENT_MEMORY_URL || 'http://localhost:3111';

export const agentMemoryService = {
  async saveMemory(req: MemorySaveRequest): Promise<boolean> {
    try {
      const res = await fetch(`${AGENT_MEMORY_URL}/agentmemory/remember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: req.content,
          concepts: req.tags || [],
        }),
      });
      return res.status === 201 || res.status === 200;
    } catch (err) {
      console.error('Failed to save agent memory:', err);
      return false;
    }
  },

  async recallMemory(query: string, limit = 5): Promise<MemoryResult[]> {
    try {
      const res = await fetch(`${AGENT_MEMORY_URL}/agentmemory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const rawResults = data.results || [];
      return rawResults.map((r: any) => ({
        id: r.observation?.id || r.id || 'mem_' + Math.random(),
        content: r.observation?.narrative || r.observation?.facts?.[0] || r.content || query,
        score: r.score || 0,
        tags: r.observation?.concepts || [],
      }));
    } catch (err) {
      console.error('Failed to recall agent memory:', err);
      return [];
    }
  },

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${AGENT_MEMORY_URL}/agentmemory/health`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
