import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MemoryItem } from "../models.js";
import { cosineSimilarity } from "../utils/math.js";
import { AiGateway } from "../lib/aiGateway.js";

export class MemoryService {
  private readonly memories = new Map<string, MemoryItem[]>();
  private readonly storageFilePath: string;
  private loadPromise: Promise<void>;

  constructor(
    private readonly aiGateway: AiGateway,
    private readonly embeddingModel: string,
    storageFilePath = path.resolve(process.cwd(), "data", "memories.json")
  ) {
    this.storageFilePath = storageFilePath;
    this.loadPromise = this.loadFromDisk();
  }

  private async loadFromDisk() {
    try {
      const raw = await readFile(this.storageFilePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, MemoryItem[]>;
      for (const [userId, memories] of Object.entries(parsed)) {
        this.memories.set(userId, memories);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  private async persistToDisk() {
    await mkdir(path.dirname(this.storageFilePath), { recursive: true });
    const serialized = JSON.stringify(Object.fromEntries(this.memories), null, 2);
    await writeFile(this.storageFilePath, serialized, "utf8");
  }

  async addMemory(item: Omit<MemoryItem, "id" | "createdAt" | "embedding">): Promise<MemoryItem> {
    await this.loadPromise;
    const embedding = await this.aiGateway.createEmbedding(this.embeddingModel, item.text);
    const memory: MemoryItem = {
      ...item,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      embedding
    };

    const current = this.memories.get(item.userId) ?? [];
    current.unshift(memory);
    this.memories.set(item.userId, current.slice(0, 200));
    await this.persistToDisk();
    return memory;
  }

  async findRelevantMemories(userId: string, query: string, limit = 5): Promise<MemoryItem[]> {
    await this.loadPromise;
    const userMemories = this.memories.get(userId) ?? [];
    if (userMemories.length === 0 || !query.trim()) return [];

    const queryEmbedding = await this.aiGateway.createEmbedding(this.embeddingModel, query);
    return userMemories
      .map((memory) => ({
        memory,
        similarity: cosineSimilarity(queryEmbedding, memory.embedding ?? [])
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((item) => item.memory);
  }

  async extractMemoryCandidates(userId: string, text: string): Promise<MemoryItem[]> {
    await this.loadPromise;
    if (!text.trim()) {
      return [];
    }

    const lower = text.toLowerCase();
    const candidates: Array<Omit<MemoryItem, "id" | "createdAt" | "embedding">> = [];

    if (lower.includes("喜欢") || lower.includes("讨厌")) {
      candidates.push({
        userId,
        text,
        category: "preference",
        score: 0.7
      });
    }

    if (lower.includes("朋友") || lower.includes("妈妈") || lower.includes("爸爸")) {
      candidates.push({
        userId,
        text,
        category: "relationship",
        score: 0.8
      });
    }

    if (lower.includes("难过") || lower.includes("开心") || lower.includes("焦虑")) {
      candidates.push({
        userId,
        text,
        category: "event",
        score: 0.75
      });
    }

    return Promise.all(candidates.map((candidate) => this.addMemory(candidate)));
  }

  async listMemories(userId: string, limit = 20): Promise<MemoryItem[]> {
    await this.loadPromise;
    return (this.memories.get(userId) ?? []).slice(0, limit);
  }
}
