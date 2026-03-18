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
});
