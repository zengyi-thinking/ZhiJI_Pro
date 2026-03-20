import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  CREATION_AI_BASE_URL: z.string().url(),
  CREATION_AI_API_KEY: z.string().min(1),
  MEMORY_STORAGE_PATH: z.string().min(1).default("data/memories.json"),
  MODEL_BABY_ORCHESTRATOR: z.string().default("gpt-5-chat-latest"),
  MODEL_EMOTION_AGENT: z.string().default("gpt-5-mini"),
  MODEL_IMAGE_PERCEPTION: z.string().default("gpt-4o"),
  MODEL_AUDIO_TRANSCRIBE: z.string().default("gpt-4o-transcribe"),
  MODEL_AUDIO_TTS: z.string().default("gpt-4o-mini-tts"),
  MODEL_EMBEDDING: z.string().default("text-embedding-3-small"),
  MODEL_MODERATION: z.string().default("text-moderation-latest"),
  MODEL_IMAGE_GENERATION: z.string().default("gpt-image-1-mini"),
  // Second Me OAuth 配置
  SECONDME_CLIENT_ID: z.string().default(""),
  SECONDME_CLIENT_SECRET: z.string().default(""),
  SECONDME_REDIRECT_URI: z.string().default("http://localhost:8080/api/auth/callback"),
  SECONDME_API_BASE_URL: z.string().url().default("https://api.mindverse.com/gate/lab"),
  SECONDME_OAUTH_URL: z.string().url().default("https://go.second.me/oauth/"),
  SECONDME_TOKEN_ENDPOINT: z.string().url().default("https://api.mindverse.com/gate/lab/api/oauth/token/code"),
  SECONDME_REFRESH_ENDPOINT: z.string().url().default("https://api.mindverse.com/gate/lab/api/oauth/token/refresh"),
  SECONDME_USERINFO_ENDPOINT: z.string().url().default("https://api.mindverse.com/gate/lab/api/secondme/user/info"),
  SECONDME_BASE_URL: z.string().default("https://second.me"),
  SESSION_SECRET: z.string().default("zhiji-pro-session-secret")
});

export const config = envSchema.parse(process.env);
