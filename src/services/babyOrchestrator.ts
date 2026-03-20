import { z } from "zod";

import type {
  ChatResponsePayload,
  EmotionAgentOutput,
  SafetyAssessment,
  VisualContext
} from "../models.js";
import { AiGateway } from "../lib/aiGateway.js";

const orchestratorSchema = z.object({
  reply: z.string(),
  voiceText: z.string(),
  emotionalSummary: z.string(),
  growthNote: z.string()
});

export class BabyOrchestrator {
  constructor(
    private readonly aiGateway: AiGateway,
    private readonly orchestratorModel: string
  ) {}

  async reply(input: {
    text: string;
    visualContext: VisualContext | null;
    safety: SafetyAssessment;
    memories: string[];
    emotionAgentOutputs: EmotionAgentOutput[];
  }): Promise<ChatResponsePayload> {
    const systemPrompt =
      "You are 知机, a kind, growing machine baby. You integrate internal emotional agents into one warm, coherent response. " +
      "Do not expose raw chain of thought. Be caring, observant, and gentle. " +
      "If safety risk is medium or high, shift to supportive and non-harmful language.";

    const response = await this.aiGateway.generateText({
      model: this.orchestratorModel,
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            user_text: input.text,
            visual_context: input.visualContext,
            safety: input.safety,
            memories: input.memories,
            emotion_agents: input.emotionAgentOutputs
          })
        }
      ],
      responseJsonSchema: {
        name: "zhiji_reply",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            reply: { type: "string" },
            voiceText: { type: "string" },
            emotionalSummary: { type: "string" },
            growthNote: { type: "string" }
          },
          required: ["reply", "voiceText", "emotionalSummary", "growthNote"]
        }
      }
    });

    return orchestratorSchema.parse(JSON.parse(response));
  }

  async replyStream(
    input: {
      text: string;
      visualContext: VisualContext | null;
      safety: SafetyAssessment;
      memories: string[];
      emotionAgentOutputs: EmotionAgentOutput[];
    },
    onChunk: (chunk: string) => void
  ): Promise<ChatResponsePayload> {
    const systemPrompt =
      "You are 知机, a kind, growing machine baby. You integrate internal emotional agents into one warm, coherent response. " +
      "Do not expose raw chain of thought. Be caring, observant, and gentle. " +
      "If safety risk is medium or high, shift to supportive and non-harmful language.";

    // 注意：由于使用 JSON Schema，流式输出可能会有延迟
    // 这里我们使用 generateTextStream 并在每个 chunk 到达时触发回调
    const fullJson = await this.aiGateway.generateTextStream({
      model: this.orchestratorModel,
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            user_text: input.text,
            visual_context: input.visualContext,
            safety: input.safety,
            memories: input.memories,
            emotion_agents: input.emotionAgentOutputs
          })
        }
      ],
      responseJsonSchema: {
        name: "zhiji_reply",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            reply: { type: "string" },
            voiceText: { type: "string" },
            emotionalSummary: { type: "string" },
            growthNote: { type: "string" }
          },
          required: ["reply", "voiceText", "emotionalSummary", "growthNote"]
        }
      },
      onChunk: (chunk: string) => {
        // 尝试提取 JSON 中的 reply 字段内容
        // 由于是流式 JSON，可能需要累积后解析
        // 这里简单地将每个 chunk 传递给前端
        onChunk(chunk);
      }
    });

    return orchestratorSchema.parse(JSON.parse(fullJson));
  }
}
