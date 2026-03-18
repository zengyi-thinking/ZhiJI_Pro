import type { SafetyAssessment } from "../models.js";
import { AiGateway } from "../lib/aiGateway.js";

export class SafetyService {
  constructor(
    private readonly aiGateway: AiGateway,
    private readonly moderationModel: string
  ) {}

  async assess(input: string): Promise<SafetyAssessment> {
    if (!input.trim()) {
      return {
        flagged: false,
        categories: [],
        riskLevel: "low",
        recommendedAction: "Continue normal orchestration."
      };
    }

    const result = (await this.aiGateway.moderate(this.moderationModel, input)) as {
      results?: Array<{
        flagged?: boolean;
        categories?: Record<string, boolean>;
      }>;
    };

    const first = result.results?.[0];
    const categories = Object.entries(first?.categories ?? {})
      .filter(([, flagged]) => flagged)
      .map(([name]) => name);
    const flagged = Boolean(first?.flagged);

    return {
      flagged,
      categories,
      riskLevel: flagged ? (categories.length > 1 ? "high" : "medium") : "low",
      recommendedAction: flagged
        ? "Switch to supportive safe-response template and surface help-seeking guidance if needed."
        : "Continue normal orchestration."
    };
  }
}
