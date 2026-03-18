import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config.js", () => ({
  config: {
    PORT: 3000,
    CREATION_AI_BASE_URL: "https://example.com/v1",
    CREATION_AI_API_KEY: "test-key",
    MODEL_BABY_ORCHESTRATOR: "gpt-5-chat-latest",
    MODEL_EMOTION_AGENT: "gpt-5-mini",
    MODEL_IMAGE_PERCEPTION: "gpt-4o",
    MODEL_AUDIO_TRANSCRIBE: "gpt-4o-transcribe",
    MODEL_AUDIO_TTS: "gpt-4o-mini-tts",
    MODEL_EMBEDDING: "text-embedding-3-small",
    MODEL_MODERATION: "text-moderation-latest",
    MODEL_IMAGE_GENERATION: "gpt-image-1-mini"
  }
}));

import { createApp } from "../src/app.js";

describe("app", () => {
  it("returns health status", async () => {
    const app = createApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.models.babyOrchestrator).toBe("gpt-5-chat-latest");
  });

  it("returns frontend-oriented chat payload", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(_input);
      const body =
        typeof init?.body === "string"
          ? JSON.parse(init.body)
          : undefined;

      if (url.endsWith("/moderations")) {
        return new Response(
          JSON.stringify({
            results: [{ flagged: false, categories: {} }]
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/embeddings")) {
        return new Response(
          JSON.stringify({
            data: [{ embedding: [1, 0.5, 0.25] }]
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/chat/completions")) {
        if (body?.response_format?.json_schema?.name === "zhiji_reply") {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      reply: "我在，先陪你把这股难过接住。",
                      voiceText: "我在，先陪你把这股难过接住。",
                      emotionalSummary: "哀在主导，喜和惧在帮忙稳住节奏。",
                      growthNote: "知机记住了你在低落时更需要先被接住。"
                    })
                  }
                }
              ]
            }),
            { status: 200 }
          );
        }

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    emotion_view: "用户情绪低落，需要被理解。",
                    care_goal: "先安抚，再继续交流。",
                    tone_suggestion: "温柔",
                    action_suggestion: "先接住情绪，再邀请多说一点。",
                    visibility_snippet: "让我先抱一抱这份难过。",
                    weight: 0.72
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unhandled fetch url: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const app = createApp();
    const response = await request(app).post("/api/chat").send({
      userId: "user-1",
      sessionId: "session-1",
      text: "今天有点难过"
    });

    expect(response.status).toBe(200);
    expect(response.body.message.reply).toContain("我在");
    expect(response.body.agents).toHaveLength(5);
    expect(response.body.console.dominantAgent).toBeTruthy();
    expect(response.body.console.tasks).toBeInstanceOf(Array);
    expect(response.body.memory.newMemories).toBeInstanceOf(Array);
    expect(response.body.growth.stage).toBeTruthy();
    expect(response.body.meta.visualContextPresent).toBe(false);
  });

  it("falls back when provider returns account error", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      const url = String(_input);

      if (
        url.endsWith("/moderations") ||
        url.endsWith("/embeddings") ||
        url.endsWith("/chat/completions")
      ) {
        return new Response(
          JSON.stringify({
            error: {
              message: "account deactivated",
              code: "account_deactivated"
            }
          }),
          { status: 401 }
        );
      }

      throw new Error(`Unhandled fetch url: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const app = createApp();
    const response = await request(app).post("/api/chat").send({
      userId: "user-1",
      sessionId: "session-1",
      text: "今天真的有点难过"
    });

    expect(response.status).toBe(200);
    expect(response.body.meta.degraded).toBe(true);
    expect(response.body.meta.providerStatus).toBe("fallback");
    expect(response.body.message.reply).toContain("陪");
    expect(response.body.console.tasks[0].status).toBe("fallback");
  });

  it("returns persisted memories by user id", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      const url = String(_input);

      if (url.endsWith("/embeddings")) {
        return new Response(
          JSON.stringify({
            data: [{ embedding: [1, 0.5, 0.25] }]
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/moderations")) {
        return new Response(
          JSON.stringify({
            results: [{ flagged: false, categories: {} }]
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/chat/completions")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    emotion_view: "用户情绪低落，需要被理解。",
                    care_goal: "先安抚，再继续交流。",
                    tone_suggestion: "温柔",
                    action_suggestion: "先接住情绪，再邀请多说一点。",
                    visibility_snippet: "让我先抱一抱这份难过。",
                    weight: 0.72
                  })
                }
              }
            ]
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unhandled fetch url: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const app = createApp();
    const memoryResponse = await request(app).get("/api/memories").query({ userId: "user-1" });

    expect(memoryResponse.status).toBe(200);
    expect(memoryResponse.body.memories).toBeInstanceOf(Array);
  });
});
