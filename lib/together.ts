import type {
  BenchmarkModelConfig,
  BenchmarkRequest,
  BenchmarkResult,
  TokenUsage
} from "@/lib/benchmark";
import { getEnv } from "@/lib/env";
import {
  createBenchmarkError,
  estimateCostUsd,
  readProviderJson
} from "@/lib/results";
import {
  parseOpenAICompatibleStream,
  type ProviderStreamChunk
} from "@/lib/stream-utils";

interface TogetherChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
  message?: string;
}

const TOGETHER_TRANSIENT_RETRIES = 2;

export async function* streamTogetherBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): AsyncGenerator<ProviderStreamChunk> {
  const apiKey = getEnv("TOGETHER_API_KEY");
  const response = await createTogetherCompletion(apiKey, model, request, true);

  if (!response.ok) {
    const payload = await readProviderJson<TogetherChatCompletionResponse>(response);
    throw new Error(getTogetherErrorMessage(payload, response.status, model.apiModel));
  }

  if (!response.body) {
    throw new Error("Together API returned an empty streaming body.");
  }

  yield* parseOpenAICompatibleStream(response.body);
}

export async function runTogetherBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): Promise<BenchmarkResult> {
  const startedAt = performance.now();

  try {
    const apiKey = getEnv("TOGETHER_API_KEY");
    const response = await createTogetherCompletion(apiKey, model, request, false);
    const latencyMs = Math.round(performance.now() - startedAt);
    const payload = await readProviderJson<TogetherChatCompletionResponse>(response);

    if (!response.ok) {
      throw new Error(
        getTogetherErrorMessage(payload, response.status, model.apiModel)
      );
    }

    const usage: TokenUsage = {
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
      totalTokens: payload.usage?.total_tokens ?? 0
    };

    return {
      id: model.id,
      provider: model.provider,
      label: model.label,
      apiModel: model.apiModel,
      output: payload.choices?.[0]?.message?.content ?? "",
      latencyMs,
      usage,
      estimatedCostUsd: estimateCostUsd(usage, model.pricing),
      status: "success",
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    return createBenchmarkError(
      model,
      Math.round(performance.now() - startedAt),
      error
    );
  }
}

async function createTogetherCompletion(
  apiKey: string,
  model: BenchmarkModelConfig,
  request: BenchmarkRequest,
  stream: boolean
): Promise<Response> {
  for (let attempt = 0; attempt <= TOGETHER_TRANSIENT_RETRIES; attempt += 1) {
    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model.apiModel,
        messages: [
          {
            role: "system",
            content:
              "Answer the user directly. Do not invent facts. If uncertain, say what is uncertain."
          },
          {
            role: "user",
            content: request.prompt
          }
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stream
      })
    });

    if (![502, 503, 504, 429].includes(response.status) || attempt === TOGETHER_TRANSIENT_RETRIES) {
      return response;
    }

    await delay(700 * (attempt + 1));
  }

  throw new Error("Together API request failed before a response was returned.");
}

function getTogetherErrorMessage(
  payload: TogetherChatCompletionResponse,
  status: number,
  model: string
): string {
  const providerMessage = payload.error?.message ?? payload.message;

  if (providerMessage) {
    return providerMessage;
  }

  if (status === 402) {
    return `Together API returned 402 for ${model}. The key is configured, but the Together account/project needs billing credits or access for this model.`;
  }

  if (status === 503) {
    return `Together API returned 503 for ${model}. The model endpoint is temporarily unavailable on Together; try again in a moment.`;
  }

  return `Together API returned ${status} for ${model}.`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
