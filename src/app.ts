import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";

import { config } from "./config.js";
import { AiGateway } from "./lib/aiGateway.js";
import { BabyOrchestrator } from "./services/babyOrchestrator.js";
import { ChatPipeline } from "./services/chatPipeline.js";
import { EmotionAgentRuntime } from "./services/emotionAgentRuntime.js";
import { ExpressionService } from "./services/expressionService.js";
import { MemoryService } from "./services/memoryService.js";
import { PerceptionService } from "./services/perceptionService.js";
import { SafetyService } from "./services/safetyService.js";
import { SecondMeAuthService } from "./services/secondmeAuth.js";

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
  imageUrls: z.array(z.string().min(1)).min(1),
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

const authCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

// 扩展会话类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        displayName?: string;
        email?: string;
        avatar?: string;
      };
    }
  }
}

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

  // Second Me OAuth 服务
  const secondMeAuth = new SecondMeAuthService(
    config.SECONDME_CLIENT_ID,
    config.SECONDME_CLIENT_SECRET,
    config.SECONDME_REDIRECT_URI,
    {
      oauthUrl: config.SECONDME_OAUTH_URL,
      tokenEndpoint: config.SECONDME_TOKEN_ENDPOINT,
      refreshEndpoint: config.SECONDME_REFRESH_ENDPOINT,
      userInfoEndpoint: config.SECONDME_USERINFO_ENDPOINT
    }
  );

  // 会话验证中间件
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sessionToken = req.cookies?.session_token || req.headers.authorization?.replace("Bearer ", "");
    if (!sessionToken) {
      return res.status(401).json({ error: "Unauthorized: No session token provided" });
    }

    const user = secondMeAuth.validateSession(sessionToken);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
    }

    req.user = user;
    next();
  };

  // 可选的会话中间件（如果存在则附加用户信息，否则继续）
  const optionalAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sessionToken = req.cookies?.session_token || req.headers.authorization?.replace("Bearer ", "");
    if (sessionToken) {
      const user = secondMeAuth.validateSession(sessionToken);
      if (user) {
        req.user = user;
      }
    }
    next();
  };

  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json({ limit: "20mb" }));
  app.use(cookieParser());
  app.use(express.static(path.join(rootDir, "public")));

  // ===== Second Me OAuth 路由 =====

  // 获取登录 URL
  app.get("/api/auth/login", (req, res) => {
    const { redirect_uri } = req.query;
    const { url, state } = secondMeAuth.generateLoginUrl(redirect_uri as string | undefined);
    res.json({ loginUrl: url, state });
  });

  // OAuth 回调
  app.get("/api/auth/callback", async (req, res) => {
    try {
      const { code, state } = authCallbackSchema.parse(req.query);
      const { sessionToken, user } = await secondMeAuth.handleCallback(code, state);

      // 设置 session cookie
      res.cookie("session_token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 天
      });

      // 重定向到前端
      res.redirect("/?auth=success");
    } catch (error) {
      console.error("Auth callback error:", error);
      res.redirect("/?auth=error");
    }
  });

  // 获取当前用户信息
  app.get("/api/auth/me", (req, res) => {
    const sessionToken = req.cookies?.session_token || req.headers.authorization?.replace("Bearer ", "");
    if (!sessionToken) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = secondMeAuth.validateSession(sessionToken);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    res.json({ user });
  });

  // 登出
  app.post("/api/auth/logout", (req, res) => {
    const sessionToken = req.cookies?.session_token || req.headers.authorization?.replace("Bearer ", "");
    if (sessionToken) {
      secondMeAuth.logout(sessionToken);
    }

    res.clearCookie("session_token");
    res.json({ success: true });
  });

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

  // SSE 流式聊天路由
  app.post("/api/chat/stream", async (req, res) => {
    const payload = chatRequestSchema.parse(req.body);

    // 设置 SSE 响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // 禁用 Nginx 缓冲

    // SSE 发送辅助函数
    const sendEvent = (eventType: string, data: unknown) => {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await chatPipeline.runStream(payload, sendEvent);
    } catch (error) {
      sendEvent("error", {
        message: error instanceof Error ? error.message : "未知错误",
        phase: "pipeline_execution",
        fallback: false
      });
    } finally {
      res.end();
    }
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

    let result;
    try {
      result = await aiGateway.transcribeAudio(
        config.MODEL_AUDIO_TRANSCRIBE,
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype
      );
    } catch {
      result = await aiGateway.transcribeAudio(
        "whisper-1",
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype
      );
    }

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
