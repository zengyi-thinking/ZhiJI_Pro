import type {
  ChatApiResponse,
  ChatResponsePayload,
  ChatTurnInput,
  EmotionAgentOutput,
  GrowthState,
  SafetyAssessment,
  VisualContext
} from "../models.js";
import { AiGatewayError } from "../lib/aiGateway.js";
import { BabyOrchestrator } from "./babyOrchestrator.js";
import { EmotionAgentRuntime } from "./emotionAgentRuntime.js";
import { MemoryService } from "./memoryService.js";
import { PerceptionService } from "./perceptionService.js";
import { SafetyService } from "./safetyService.js";

export class ChatPipeline {
  private readonly growthBySession = new Map<string, GrowthState>();
  private readonly agentGrowthBySession = new Map<
    string,
    Record<
      EmotionAgentOutput["agent"],
      { level: number; xp: number; temperamentShift: string }
    >
  >();

  constructor(
    private readonly safetyService: SafetyService,
    private readonly memoryService: MemoryService,
    private readonly perceptionService: PerceptionService,
    private readonly emotionRuntime: EmotionAgentRuntime,
    private readonly babyOrchestrator: BabyOrchestrator
  ) {}

  async run(input: ChatTurnInput): Promise<ChatApiResponse> {
    const sourceText = [input.text, input.audioTranscript].filter(Boolean).join("\n").trim();
    const warnings: string[] = [];
    let degraded = false;

    const safety = await this.tryOrFallback(
      () => this.safetyService.assess(sourceText),
      () => this.fallbackSafetyAssessment(sourceText),
      warnings,
      () => {
        degraded = true;
      }
    );
    const visualContext = await this.tryOrFallback(
      () => this.perceptionService.analyzeImages(input.imageUrls ?? [], sourceText),
      () => this.fallbackVisualContext(input.imageUrls ?? [], sourceText),
      warnings,
      () => {
        degraded = true;
      }
    );
    const relevantMemories = await this.tryOrFallback(
      () => this.memoryService.findRelevantMemories(input.userId, sourceText),
      async () => [],
      warnings,
      () => {
        degraded = true;
      }
    );
    const emotionAgents = await this.tryOrFallback(
      () =>
        this.emotionRuntime.run({
          text: sourceText,
          visualContext,
          memoryContext: relevantMemories.map((item) => item.text)
        }),
      () => this.fallbackEmotionAgents(sourceText),
      warnings,
      () => {
        degraded = true;
      }
    );
    const reply = await this.tryOrFallback(
      () =>
        this.babyOrchestrator.reply({
          text: sourceText,
          visualContext,
          safety,
          memories: relevantMemories.map((item) => item.text),
          emotionAgentOutputs: emotionAgents
        }),
      () => this.fallbackReply(sourceText, emotionAgents, safety),
      warnings,
      () => {
        degraded = true;
      }
    );
    const storedMemories = await this.tryOrFallback(
      () => this.memoryService.extractMemoryCandidates(input.userId, sourceText),
      async () => [],
      warnings,
      () => {
        degraded = true;
      }
    );
    const dominantAgent =
      emotionAgents.slice().sort((left, right) => right.weight - left.weight)[0]?.agent ?? "joy";
    const growth = this.updateGrowthState(
      input.sessionId,
      relevantMemories.length,
      storedMemories.length,
      emotionAgents
    );
    const tasks = this.buildConsoleTasks({
      sourceText,
      visualContext,
      relevantMemories: relevantMemories.map((item) => item.text),
      emotionAgents,
      dominantAgent,
      reply,
      degraded
    });
    const sequence = this.buildConsoleSequence(emotionAgents, dominantAgent, reply.reply);

    return {
      message: reply,
      agents: emotionAgents.map((agent) => ({
        agent: agent.agent,
        visibility_snippet: agent.visibility_snippet,
        weight: agent.weight,
        emotion_view: agent.emotion_view,
        care_goal: agent.care_goal,
        stance: this.buildAgentStance(agent),
        energy: this.buildAgentEnergy(agent),
        mood: this.buildAgentMood(agent)
      })),
      console: {
        dominantAgent,
        consensusSummary: reply.emotionalSummary,
        tasks,
        sequence
      },
      memory: {
        newMemories: storedMemories.map((item) => ({
          id: item.id,
          text: item.text,
          category: item.category
        })),
        relevantMemories: relevantMemories.map((item) => ({
          id: item.id,
          text: item.text,
          category: item.category
        }))
      },
      growth,
      meta: {
        safety,
        visualContextPresent: visualContext !== null,
        degraded,
        providerStatus: degraded ? "fallback" : "live",
        warnings
      }
    };
  }

  private async tryOrFallback<T>(
    run: () => Promise<T>,
    fallback: () => Promise<T> | T,
    warnings: string[],
    onFallback: () => void
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      onFallback();
      warnings.push(this.formatWarning(error));
      return await fallback();
    }
  }

  private formatWarning(error: unknown) {
    if (error instanceof AiGatewayError) {
      return `模型服务不可用，已切换到本地降级模式：${error.status}`;
    }
    return error instanceof Error ? error.message : "未知错误，已切换到降级模式";
  }

  private fallbackSafetyAssessment(input: string): SafetyAssessment {
    const highRisk = /(自杀|自残|不想活|结束生命)/.test(input);
    return {
      flagged: highRisk,
      categories: highRisk ? ["self-harm"] : [],
      riskLevel: highRisk ? "high" : "low",
      recommendedAction: highRisk
        ? "Switch to supportive safe-response template and encourage real-world help."
        : "Continue normal orchestration."
    };
  }

  private fallbackVisualContext(imageUrls: string[], sourceText: string): VisualContext | null {
    if (imageUrls.length === 0) {
      return null;
    }

    return {
      scene_summary: `用户发送了 ${imageUrls.length} 张图片，当前使用本地降级描述。`,
      emotional_cues: sourceText ? ["结合文字继续理解用户情绪"] : ["需要结合图像氛围安抚用户"],
      sensitive_signals: [],
      possible_topics: ["图片里的场景", "用户想分享的当下"],
      memory_candidates: []
    };
  }

  private fallbackEmotionAgents(text: string): EmotionAgentOutput[] {
    const normalized = text || "用户发来了图片或语音，想要被理解。";
    return [
      {
        agent: "joy",
        emotion_view: "用户需要一点点亮光来缓冲当下情绪。",
        care_goal: "给出希望感",
        tone_suggestion: "温暖轻柔",
        action_suggestion: "先肯定对方愿意说出来，再给一点陪伴感。",
        visibility_snippet: `我想先让气氛别那么沉，告诉 TA 我在听：${normalized.slice(0, 20)}`,
        weight: 0.42
      },
      {
        agent: "sadness",
        emotion_view: "用户更需要被理解，而不是马上被解决。",
        care_goal: "接住情绪",
        tone_suggestion: "共情缓慢",
        action_suggestion: "允许低落存在，先陪着。",
        visibility_snippet: "先别急着好起来，让我陪你把难受说完整。",
        weight: 0.84
      },
      {
        agent: "anger",
        emotion_view: "用户可能受了委屈或被消耗。",
        care_goal: "保护边界",
        tone_suggestion: "坚定克制",
        action_suggestion: "提醒用户不用勉强自己。",
        visibility_snippet: "如果这件事让你不舒服，那份不舒服本来就值得被认真对待。",
        weight: 0.48
      },
      {
        agent: "fear",
        emotion_view: "用户可能在担心后续会更糟。",
        care_goal: "降低不确定性",
        tone_suggestion: "谨慎安稳",
        action_suggestion: "给一个很小的下一步。",
        visibility_snippet: "我们先别一下子看太远，先把下一分钟安顿好。",
        weight: 0.56
      },
      {
        agent: "disgust",
        emotion_view: "用户可能已经很疲惫，没法再忍受假安慰。",
        care_goal: "去掉多余噪音",
        tone_suggestion: "简洁真诚",
        action_suggestion: "少说教，多真实陪伴。",
        visibility_snippet: "别端着，也别套路化，直接真诚一点陪 TA 就好。",
        weight: 0.44
      }
    ];
  }

  private fallbackReply(
    sourceText: string,
    emotionAgents: EmotionAgentOutput[],
    safety: SafetyAssessment
  ): ChatResponsePayload {
    const dominantAgent =
      emotionAgents.slice().sort((left, right) => right.weight - left.weight)[0]?.agent ?? "sadness";
    const dominantMap = {
      joy: "我想先给你一点点亮光",
      sadness: "我想先把你的情绪接住",
      anger: "我想先站在你这边",
      fear: "我想先陪你稳下来",
      disgust: "我想先把那些让你更累的噪音挡掉"
    } as const;
    const lead = dominantMap[dominantAgent];

    const reply = safety.flagged
      ? "我在。你现在的状态值得被认真对待，先不要一个人扛着。请立刻联系你信任的人，或尽快寻求当地紧急支持和专业帮助。"
      : `${lead}。${sourceText ? `你刚刚说“${sourceText.slice(0, 48)}${sourceText.length > 48 ? "…" : ""}”，` : ""}如果你愿意，我可以陪你把这件事一点点拆开，不着急。`;

    return {
      reply,
      voiceText: reply,
      emotionalSummary: "当前处于本地降级模式，控制台仍在模拟五个情绪的协作结果。",
      growthNote: "虽然模型服务暂时不可用，知机仍记录了这次陪伴的节奏。"
    };
  }

  private buildConsoleTasks(input: {
    sourceText: string;
    visualContext: VisualContext | null;
    relevantMemories: string[];
    emotionAgents: EmotionAgentOutput[];
    dominantAgent: ChatApiResponse["console"]["dominantAgent"];
    reply: ChatResponsePayload;
    degraded: boolean;
  }): ChatApiResponse["console"]["tasks"] {
    const taskStatus: "completed" | "fallback" = input.degraded ? "fallback" : "completed";
    const baseTasks: ChatApiResponse["console"]["tasks"] = [
      {
        id: "sense-input",
        phase: "input-arrival",
        title: "接管输入舱",
        owner: "system" as const,
        detail: input.visualContext
          ? "控制室正在同时读取文字、图片或语音信号。"
          : "控制室已接住这轮用户输入并送往各工位。",
        priority: 1,
        movement: "arrive",
        canInterrupt: false,
        status: taskStatus
      },
      {
        id: "fear-scan",
        phase: "risk-scan",
        title: "风险扫描",
        owner: "fear",
        detail: "Fear 先检查不确定性、危险和后续风险。",
        priority: 2,
        movement: "step-forward",
        canInterrupt: false,
        status: taskStatus
      },
      {
        id: "disgust-filter",
        phase: "filter",
        title: "社交过滤",
        owner: "disgust",
        detail: "Disgust 过滤掉假安慰、别扭表达和不合时宜的反应。",
        priority: 3,
        movement: "step-forward",
        canInterrupt: false,
        status: taskStatus
      },
      {
        id: "anger-boundary",
        phase: "boundary",
        title: "边界判断",
        owner: "anger",
        detail: "Anger 评估是否有委屈、是否该站在用户这边守住边界。",
        priority: 4,
        movement: "step-forward",
        canInterrupt: true,
        status: taskStatus
      },
      {
        id: "sadness-empathy",
        phase: "empathy",
        title: "共情接住",
        owner: "sadness",
        detail: "Sadness 接住脆弱，让回复先理解再建议。",
        priority: 5,
        movement: "step-forward",
        canInterrupt: true,
        status: taskStatus
      },
      {
        id: "joy-hope",
        phase: "hope",
        title: "希望整合",
        owner: "joy",
        detail: "Joy 负责收束气氛，让回复有亮度但不虚假。",
        priority: 6,
        movement: "step-forward",
        canInterrupt: true,
        status: taskStatus
      },
      {
        id: "memory-scan",
        phase: "interrupt",
        title: "翻查记忆柜",
        owner: "memory" as const,
        detail:
          input.relevantMemories.length > 0
            ? `调取到 ${input.relevantMemories.length} 条相关记忆，供情绪室参考。`
            : "本轮没有命中旧记忆，按当下情绪现场判断。",
        priority: 7,
        movement: "interrupt",
        canInterrupt: false,
        status: taskStatus
      },
      {
        id: "emotion-roundtable",
        phase: "dominance",
        title: "抢控制台",
        owner: input.dominantAgent,
        detail: `五个情绪完成争论，本轮由${input.dominantAgent}工位取得主导权。`,
        priority: 8,
        movement: "take-console",
        canInterrupt: false,
        status: taskStatus
      },
      {
        id: "baby-compose",
        phase: "compose",
        title: "主脑汇总发言",
        owner: "baby" as const,
        detail: input.reply.reply,
        priority: 9,
        movement: "return",
        canInterrupt: false,
        status: taskStatus
      }
    ];

    const interruptions = input.emotionAgents
      .filter((agent) => agent.agent !== input.dominantAgent)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 2)
      .map((agent, index) => ({
        id: `interrupt-${agent.agent}`,
        phase: "interrupt" as const,
        title: `${agent.agent} 插话`,
        owner: agent.agent,
        detail: agent.visibility_snippet,
        priority: 7 + index / 10,
        movement: "interrupt" as const,
        canInterrupt: true,
        status: taskStatus
      }));

    return [...baseTasks.slice(0, 6), ...interruptions, ...baseTasks.slice(6)];
  }

  private updateGrowthState(
    sessionId: string,
    relevantMemoryCount: number,
    newMemoryCount: number,
    emotionAgents: EmotionAgentOutput[]
  ): GrowthState {
    const previous = this.growthBySession.get(sessionId) ?? {
      interactionCount: 0,
      understandingScore: 18,
      intimacyScore: 12,
      stage: "幼态" as const
    };

    const interactionCount = previous.interactionCount + 1;
    const understandingScore = Math.min(
      100,
      previous.understandingScore + 6 + relevantMemoryCount * 3 + newMemoryCount * 4
    );
    const intimacyScore = Math.min(100, previous.intimacyScore + 5 + relevantMemoryCount * 2);
    const stage =
      understandingScore >= 70 ? "懂你期" : understandingScore >= 35 ? "熟悉期" : "幼态";

    const agentGrowth = this.updateAgentGrowthState(sessionId, emotionAgents);

    const nextState = {
      interactionCount,
      understandingScore,
      intimacyScore,
      stage,
      agentGrowth
    } satisfies GrowthState;

    this.growthBySession.set(sessionId, nextState);
    return nextState;
  }

  private updateAgentGrowthState(
    sessionId: string,
    emotionAgents: EmotionAgentOutput[]
  ): NonNullable<GrowthState["agentGrowth"]> {
    const current =
      this.agentGrowthBySession.get(sessionId) ?? {
        joy: { level: 1, xp: 0, temperamentShift: "更会点亮气氛" },
        sadness: { level: 1, xp: 0, temperamentShift: "更会安静接住情绪" },
        anger: { level: 1, xp: 0, temperamentShift: "更懂得保护边界" },
        fear: { level: 1, xp: 0, temperamentShift: "更会预判风险" },
        disgust: { level: 1, xp: 0, temperamentShift: "更会过滤别扭表达" }
      };

    for (const agent of emotionAgents) {
      const entry = current[agent.agent];
      const gainedXp = Math.max(6, Math.round(agent.weight * 24));
      entry.xp += gainedXp;
      if (entry.xp >= 100) {
        entry.level += Math.floor(entry.xp / 100);
        entry.xp = entry.xp % 100;
      }
    }

    this.agentGrowthBySession.set(sessionId, current);
    return current;
  }

  private buildAgentStance(agent: EmotionAgentOutput) {
    const stanceMap = {
      joy: "提亮",
      sadness: "安抚",
      anger: "护边界",
      fear: "提醒",
      disgust: "过滤"
    } as const;
    return stanceMap[agent.agent];
  }

  private buildAgentEnergy(agent: EmotionAgentOutput) {
    return Math.max(1, Math.min(5, Math.round(agent.weight * 5)));
  }

  private buildAgentMood(agent: EmotionAgentOutput): "calm" | "alert" | "supportive" | "heated" | "bright" {
    const moodMap = {
      joy: "bright",
      sadness: "supportive",
      anger: "heated",
      fear: "alert",
      disgust: "calm"
    } as const;
    return moodMap[agent.agent];
  }

  private buildConsoleSequence(
    emotionAgents: EmotionAgentOutput[],
    dominantAgent: ChatApiResponse["console"]["dominantAgent"],
    reply: string
  ): ChatApiResponse["console"]["sequence"] {
    const byAgent = Object.fromEntries(emotionAgents.map((agent) => [agent.agent, agent])) as Record<
      EmotionAgentOutput["agent"],
      EmotionAgentOutput
    >;
    const fixedOrder: EmotionAgentOutput["agent"][] = ["fear", "disgust", "anger", "sadness", "joy"];
    const interruptions = fixedOrder
      .filter((agent) => agent !== dominantAgent)
      .sort((left, right) => byAgent[right].weight - byAgent[left].weight)
      .slice(0, 2);

    const sequence: ChatApiResponse["console"]["sequence"] = [
      {
        id: "seq-input",
        actor: "system",
        mode: "announce",
        detail: "新消息进入操作室，控制台开始亮起。",
        durationMs: 700,
        phase: "input-arrival"
      }
    ];

    const phaseMap = {
      fear: "risk-scan",
      disgust: "filter",
      anger: "boundary",
      sadness: "empathy",
      joy: "hope"
    } as const;

    fixedOrder.forEach((agent, index) => {
      sequence.push({
        id: `seq-${agent}`,
        actor: agent,
        mode: "speak",
        detail: byAgent[agent].visibility_snippet,
        durationMs: 900,
        phase: phaseMap[agent]
      });

      if (index === 2 && interruptions[0]) {
        sequence.push({
          id: `seq-interrupt-${interruptions[0]}`,
          actor: interruptions[0],
          mode: "interrupt",
          detail: byAgent[interruptions[0]].visibility_snippet,
          durationMs: 680,
          phase: "interrupt"
        });
      }
    });

    if (interruptions[1]) {
      sequence.push({
        id: `seq-interrupt-${interruptions[1]}`,
        actor: interruptions[1],
        mode: "interrupt",
        detail: byAgent[interruptions[1]].visibility_snippet,
        durationMs: 640,
        phase: "interrupt"
      });
    }

    sequence.push(
      {
        id: "seq-dominance",
        actor: dominantAgent,
        mode: "take-console",
        detail: `${dominantAgent} 抢到了中央控制台，准备拍板。`,
        durationMs: 900,
        phase: "dominance"
      },
      {
        id: "seq-compose",
        actor: "baby",
        mode: "compose",
        detail: reply,
        durationMs: 1000,
        phase: "compose"
      }
    );

    return sequence;
  }
}
