export const emotionAgents = [
  "joy",
  "sadness",
  "anger",
  "fear",
  "disgust"
] as const;

export type EmotionAgentName = (typeof emotionAgents)[number];

export type ChatTurnInput = {
  userId: string;
  sessionId: string;
  text?: string;
  imageUrls?: string[];
  audioTranscript?: string;
};

export type GrowthState = {
  interactionCount: number;
  understandingScore: number;
  intimacyScore: number;
  stage: "幼态" | "熟悉期" | "懂你期";
  agentGrowth?: Record<
    EmotionAgentName,
    {
      level: number;
      xp: number;
      temperamentShift: string;
    }
  >;
};

export type VisualContext = {
  scene_summary: string;
  emotional_cues: string[];
  sensitive_signals: string[];
  possible_topics: string[];
  memory_candidates: string[];
};

export type EmotionAgentOutput = {
  agent: EmotionAgentName;
  emotion_view: string;
  care_goal: string;
  tone_suggestion: string;
  action_suggestion: string;
  visibility_snippet: string;
  weight: number;
};

export type SafetyAssessment = {
  flagged: boolean;
  categories: string[];
  riskLevel: "low" | "medium" | "high";
  recommendedAction: string;
};

export type MemoryItem = {
  id: string;
  userId: string;
  text: string;
  category: "preference" | "relationship" | "event" | "comfort" | "growth";
  score: number;
  createdAt: string;
  embedding?: number[];
};

export type ChatResponsePayload = {
  reply: string;
  voiceText: string;
  emotionalSummary: string;
  growthNote: string;
};

export type ChatApiResponse = {
  message: ChatResponsePayload;
  agents: Array<{
    agent: EmotionAgentName;
    visibility_snippet: string;
    weight: number;
    emotion_view: string;
    care_goal: string;
    stance: string;
    energy: number;
    mood: "calm" | "alert" | "supportive" | "heated" | "bright";
  }>;
  console: {
    dominantAgent: EmotionAgentName;
    consensusSummary: string;
    tasks: Array<{
      id: string;
      phase:
        | "input-arrival"
        | "risk-scan"
        | "filter"
        | "boundary"
        | "empathy"
        | "hope"
        | "interrupt"
        | "dominance"
        | "compose";
      title: string;
      owner: EmotionAgentName | "system" | "memory" | "baby";
      detail: string;
      priority: number;
      movement: "arrive" | "step-forward" | "interrupt" | "take-console" | "return";
      canInterrupt: boolean;
      status: "completed" | "fallback";
    }>;
    sequence: Array<{
      id: string;
      actor: EmotionAgentName | "system" | "baby";
      mode: "announce" | "speak" | "interrupt" | "take-console" | "compose";
      detail: string;
      durationMs: number;
      phase:
        | "input-arrival"
        | "risk-scan"
        | "filter"
        | "boundary"
        | "empathy"
        | "hope"
        | "interrupt"
        | "dominance"
        | "compose";
    }>;
  };
  memory: {
    newMemories: Array<{
      id: string;
      text: string;
      category: string;
    }>;
    relevantMemories: Array<{
      id: string;
      text: string;
      category: string;
    }>;
  };
  growth: GrowthState;
  meta: {
    safety: SafetyAssessment;
    visualContextPresent: boolean;
    degraded: boolean;
    providerStatus: "live" | "fallback";
    warnings: string[];
  };
};
