import { z } from "zod";

import type { EmotionAgentName, EmotionAgentOutput, VisualContext } from "../models.js";
import { emotionAgents } from "../models.js";
import { AiGateway } from "../lib/aiGateway.js";

const agentOutputSchema = z.object({
  emotion_view: z.string(),
  care_goal: z.string(),
  tone_suggestion: z.string(),
  action_suggestion: z.string(),
  visibility_snippet: z.string(),
  weight: z.number().min(0).max(1)
});

const agentPersonas: Record<EmotionAgentName, string> = {
  joy: "You are Joy. You notice hope, warmth, small delights, and emotional lift without being fake or dismissive.",
  sadness: "You are Sadness. You validate hurt, allow vulnerability, and help the user feel understood.",
  anger: "You are Anger. You protect dignity, identify unfairness, and advocate for clear boundaries without escalating harm.",
  fear: "You are Fear. You spot risks, uncertainty, and practical caution while staying compassionate.",
  disgust: "You are Disgust. You detect aversion, mismatch, social discomfort, and self-protection against what feels wrong."
};

export class EmotionAgentRuntime {
  constructor(
    private readonly aiGateway: AiGateway,
    private readonly emotionModel: string
  ) {}

  async run(input: {
    text: string;
    visualContext: VisualContext | null;
    memoryContext: string[];
  }): Promise<EmotionAgentOutput[]> {
    return Promise.all(
      emotionAgents.map(async (agent) => {
        const response = await this.aiGateway.generateText({
          model: this.emotionModel,
          temperature: 0.8,
          messages: [
            {
              role: "system",
              content:
                `${agentPersonas[agent]} ` +
                "Respond as a structured internal emotional agent in a multi-agent companion system."
            },
            {
              role: "user",
              content: JSON.stringify({
                user_text: input.text,
                visual_context: input.visualContext,
                memories: input.memoryContext
              })
            }
          ],
          responseJsonSchema: {
            name: `${agent}_agent_output`,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                emotion_view: { type: "string" },
                care_goal: { type: "string" },
                tone_suggestion: { type: "string" },
                action_suggestion: { type: "string" },
                visibility_snippet: { type: "string" },
                weight: { type: "number" }
              },
              required: [
                "emotion_view",
                "care_goal",
                "tone_suggestion",
                "action_suggestion",
                "visibility_snippet",
                "weight"
              ]
            }
          }
        });

        return {
          agent,
          ...agentOutputSchema.parse(JSON.parse(response))
        };
      })
    );
  }
}
