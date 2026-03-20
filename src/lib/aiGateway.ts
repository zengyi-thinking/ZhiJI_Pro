type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

export class AiGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AiGatewayError(
        `AI gateway request failed: ${response.status} ${errorText}`,
        response.status,
        errorText
      );
    }

    return (await response.json()) as T;
  }

  async generateText(options: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    responseJsonSchema?: JsonSchema;
  }): Promise<string> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7
    };

    if (options.responseJsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: options.responseJsonSchema.name,
          schema: options.responseJsonSchema.schema,
          strict: true
        }
      };
    }

    const result = await this.request<{
      choices: Array<{ message: { content: string | null } }>;
    }>("/chat/completions", {
      method: "POST",
      body: JSON.stringify(body)
    });

    return result.choices[0]?.message?.content ?? "";
  }

  async generateTextStream(options: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    responseJsonSchema?: JsonSchema;
    onChunk: (chunk: string) => void;
  }): Promise<string> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      stream: true
    };

    if (options.responseJsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: options.responseJsonSchema.name,
          schema: options.responseJsonSchema.schema,
          strict: true
        }
      };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AiGatewayError(
        `AI gateway streaming request failed: ${response.status} ${errorText}`,
        response.status,
        errorText
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(line => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              options.onChunk(content);
            }
          } catch (e) {
            console.error("Failed to parse SSE chunk:", e);
          }
        }
      }
    }

    return fullContent;
  }

  async createEmbedding(model: string, input: string): Promise<number[]> {
    const result = await this.request<{
      data: Array<{ embedding: number[] }>;
    }>("/embeddings", {
      method: "POST",
      body: JSON.stringify({ model, input })
    });

    return result.data[0]?.embedding ?? [];
  }

  async moderate(model: string, input: string): Promise<Record<string, unknown>> {
    return this.request("/moderations", {
      method: "POST",
      body: JSON.stringify({ model, input })
    });
  }

  async transcribeAudio(model: string, fileName: string, fileBuffer: Buffer, mimeType: string) {
    const formData = new FormData();
    formData.append("model", model);
    const bytes = new Uint8Array(fileBuffer);
    formData.append("file", new Blob([bytes], { type: mimeType }), fileName);

    return this.request<{ text: string }>("/audio/transcriptions", {
      method: "POST",
      body: formData
    });
  }

  async synthesizeSpeech(model: string, input: string, voice: string) {
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input,
        voice
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AiGatewayError(
        `Speech synthesis failed: ${response.status} ${errorText}`,
        response.status,
        errorText
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async generateImage(model: string, prompt: string): Promise<string | null> {
    const result = await this.request<{
      data?: Array<{ b64_json?: string; url?: string }>;
    }>("/images/generations", {
      method: "POST",
      body: JSON.stringify({
        model,
        prompt,
        size: "1024x1024"
      })
    });

    const image = result.data?.[0];
    if (!image) return null;
    if (image.url) return image.url;
    if (image.b64_json) return `data:image/png;base64,${image.b64_json}`;
    return null;
  }
}
export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}
