import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  CREATION_AI_BASE_URL: z.string().url(),
  CREATION_AI_API_KEY: z.string().min(1),
  MODEL_BABY_ORCHESTRATOR: z.string().default("gpt-5-chat-latest"),
  MODEL_EMOTION_AGENT: z.string().default("gpt-5-mini"),
  MODEL_IMAGE_PERCEPTION: z.string().default("gpt-4o"),
  MODEL_AUDIO_TRANSCRIBE: z.string().default("gpt-4o-transcribe"),
  MODEL_AUDIO_TTS: z.string().default("gpt-4o-mini-tts"),
  MODEL_EMBEDDING: z.string().default("text-embedding-3-small"),
  MODEL_MODERATION: z.string().default("text-moderation-latest"),
  MODEL_IMAGE_GENERATION: z.string().default("gpt-image-1-mini")
});

export const config = envSchema.parse(process.env);
