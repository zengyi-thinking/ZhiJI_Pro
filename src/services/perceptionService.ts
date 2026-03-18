import { z } from "zod";

import type { VisualContext } from "../models.js";
import { AiGateway } from "../lib/aiGateway.js";

const visualContextSchema = z.object({
  scene_summary: z.string(),
  emotional_cues: z.array(z.string()),
  sensitive_signals: z.array(z.string()),
  possible_topics: z.array(z.string()),
  memory_candidates: z.array(z.string())
});

export class PerceptionService {
  constructor(
    private readonly aiGateway: AiGateway,
    private readonly imageModel: string
  ) {}

  async analyzeImages(imageUrls: string[], userText?: string): Promise<VisualContext | null> {
    if (imageUrls.length === 0) return null;

    const content = [
      {
        type: "text" as const,
        text:
          "Analyze these images for an emotional companion app. Return structured emotional context, not a user-facing answer." +
          (userText ? ` User message context: ${userText}` : "")
      },
      ...imageUrls.map((url) => ({
        type: "image_url" as const,
        image_url: { url }
      }))
    ];

    const response = await this.aiGateway.generateText({
      model: this.imageModel,
      messages: [{ role: "user", content }],
      temperature: 0.2,
      responseJsonSchema: {
        name: "visual_context",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            scene_summary: { type: "string" },
            emotional_cues: { type: "array", items: { type: "string" } },
            sensitive_signals: { type: "array", items: { type: "string" } },
            possible_topics: { type: "array", items: { type: "string" } },
            memory_candidates: { type: "array", items: { type: "string" } }
          },
          required: [
            "scene_summary",
            "emotional_cues",
            "sensitive_signals",
            "possible_topics",
            "memory_candidates"
          ]
        }
      }
    });

    return visualContextSchema.parse(JSON.parse(response));
  }
}
