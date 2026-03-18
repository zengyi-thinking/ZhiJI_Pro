import { AiGateway } from "../lib/aiGateway.js";

export class ExpressionService {
  constructor(
    private readonly aiGateway: AiGateway,
    private readonly imageModel: string,
    private readonly ttsModel: string
  ) {}

  async generateEmotionCard(prompt: string): Promise<string | null> {
    return this.aiGateway.generateImage(this.imageModel, prompt);
  }

  async synthesizeVoice(text: string, voice = "alloy"): Promise<Buffer> {
    return this.aiGateway.synthesizeSpeech(this.ttsModel, text, voice);
  }
}
