import type { TokenUsage } from "@/lib/benchmark";

const textDecoder = new TextDecoder();

export interface ProviderStreamChunk {
  token?: string;
  usage?: TokenUsage;
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  error?: {
    message?: string;
  };
}

interface AnthropicStreamChunk {
  type?: string;
  delta?: {
    type?: string;
    text?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  message?: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  error?: {
    message?: string;
  };
}

export async function* parseOpenAICompatibleStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<ProviderStreamChunk> {
  for await (const message of readServerSentEvents(body)) {
    if (message === "[DONE]") {
      return;
    }

    const chunk = parseJsonMessage<OpenAIStreamChunk>(message);

    if (chunk.error?.message) {
      throw new Error(chunk.error.message);
    }

    const token = chunk.choices?.[0]?.delta?.content;

    if (token) {
      yield { token };
    }

    if (chunk.usage) {
      yield {
        usage: {
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
          totalTokens: chunk.usage.total_tokens ?? 0
        }
      };
    }
  }
}

export async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<ProviderStreamChunk> {
  for await (const message of readServerSentEvents(body)) {
    const chunk = parseJsonMessage<AnthropicStreamChunk>(message);

    if (chunk.error?.message) {
      throw new Error(chunk.error.message);
    }

    if (chunk.type === "content_block_delta" && chunk.delta?.text) {
      yield { token: chunk.delta.text };
    }

    const usage = chunk.usage ?? chunk.message?.usage;

    if (usage) {
      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;

      yield {
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens
        }
      };
    }
  }
}

async function* readServerSentEvents(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += textDecoder.decode(value, { stream: true });
    const messages = buffer.split(/\r?\n\r?\n/);
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      const data = message
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""))
        .join("\n")
        .trim();

      if (data) {
        yield data;
      }
    }
  }

  if (buffer.trim()) {
    const data = buffer
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s?/, ""))
      .join("\n")
      .trim();

    if (data) {
      yield data;
    }
  }
}

function parseJsonMessage<T>(message: string): T {
  try {
    return JSON.parse(message) as T;
  } catch {
    throw new Error("Provider returned a malformed streaming event.");
  }
}
