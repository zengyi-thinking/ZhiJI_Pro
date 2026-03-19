import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { AiGateway } from "./lib/aiGateway.js";
import { BabyOrchestrator } from "./services/babyOrchestrator.js";
import { ChatPipeline } from "./services/chatPipeline.js";
import { EmotionAgentRuntime } from "./services/emotionAgentRuntime.js";
import { ExpressionService } from "./services/expressionService.js";
import { MemoryService } from "./services/memoryService.js";
import { PerceptionService } from "./services/perceptionService.js";
import { SafetyService } from "./services/safetyService.js";

const chatRequestSchema = z
  .object({
    userId: z.string().min(1),
    sessionId: z.string().min(1),
    text: z.string().trim().optional(),
    imageUrls: z.array(z.string().min(1)).optional(),
    audioTranscript: z.string().trim().optional()
  })
  .superRefine((value, ctx) => {
    const hasText = Boolean(value.text);
    const hasAudio = Boolean(value.audioTranscript);
    const hasImages = Boolean(value.imageUrls?.length);

    if (!hasText && !hasAudio && !hasImages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of text, audioTranscript, or imageUrls is required."
      });
    }
  });

const imageAnalyzeSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1),
  text: z.string().optional()
});

const speechSchema = z.object({
  text: z.string().min(1),
  voice: z.string().default("alloy")
});

const cardSchema = z.object({
  prompt: z.string().min(1)
});

const memoryQuerySchema = z.object({
  userId: z.string().min(1)
});

export function createApp() {
  const app = express();
  const upload = multer();
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  const aiGateway = new AiGateway(
    config.CREATION_AI_BASE_URL,
    config.CREATION_AI_API_KEY
  );

  const safetyService = new SafetyService(aiGateway, config.MODEL_MODERATION);
  const memoryService = new MemoryService(aiGateway, config.MODEL_EMBEDDING, config.MEMORY_STORAGE_PATH);
  const perceptionService = new PerceptionService(aiGateway, config.MODEL_IMAGE_PERCEPTION);
  const emotionRuntime = new EmotionAgentRuntime(aiGateway, config.MODEL_EMOTION_AGENT);
  const babyOrchestrator = new BabyOrchestrator(aiGateway, config.MODEL_BABY_ORCHESTRATOR);
  const expressionService = new ExpressionService(
    aiGateway,
    config.MODEL_IMAGE_GENERATION,
    config.MODEL_AUDIO_TTS
  );
  const chatPipeline = new ChatPipeline(
    safetyService,
    memoryService,
    perceptionService,
    emotionRuntime,
    babyOrchestrator
  );

  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use(express.static(path.join(rootDir, "public")));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      models: {
        babyOrchestrator: config.MODEL_BABY_ORCHESTRATOR,
        emotionAgent: config.MODEL_EMOTION_AGENT,
        imagePerception: config.MODEL_IMAGE_PERCEPTION,
        audioTranscribe: config.MODEL_AUDIO_TRANSCRIBE,
        audioTts: config.MODEL_AUDIO_TTS,
        embedding: config.MODEL_EMBEDDING,
        moderation: config.MODEL_MODERATION,
        imageGeneration: config.MODEL_IMAGE_GENERATION
      },
      storage: {
        memoryFile: config.MEMORY_STORAGE_PATH
      }
    });
  });

  app.post("/api/chat", async (req, res) => {
    const payload = chatRequestSchema.parse(req.body);
    const result = await chatPipeline.run(payload);
    res.json(result);
  });

  app.post("/api/perception/image-analyze", async (req, res) => {
    const payload = imageAnalyzeSchema.parse(req.body);
    const result = await perceptionService.analyzeImages(payload.imageUrls, payload.text);
    res.json({ visualContext: result });
  });

  app.post("/api/audio/transcribe", upload.single("file"), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    const result = await aiGateway.transcribeAudio(
      config.MODEL_AUDIO_TRANSCRIBE,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype
    );

    res.json({
      transcript: result.text
    });
  });

  app.get("/api/memories", async (req, res) => {
    const { userId } = memoryQuerySchema.parse(req.query);
    const memories = await memoryService.listMemories(userId);
    res.json({ memories });
  });

  app.post("/api/audio/speak", async (req, res) => {
    const payload = speechSchema.parse(req.body);
    const audio = await expressionService.synthesizeVoice(payload.text, payload.voice);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  });

  app.post("/api/expression/cards", async (req, res) => {
    const payload = cardSchema.parse(req.body);
    const image = await expressionService.generateEmotionCard(payload.prompt);
    res.json({ image });
  });

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(path.join(rootDir, "public", "index.html"));
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.flatten() });
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown server error";
    res.status(500).json({ error: message });
  });

  return app;
}
