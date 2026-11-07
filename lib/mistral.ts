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
  BENCHMARK_SYSTEM_PROMPT,
  buildBenchmarkUserPrompt
} from "@/lib/provider-prompt";
import {
  parseOpenAICompatibleStream,
  type ProviderStreamChunk
} from "@/lib/stream-utils";

interface MistralChatCompletionResponse {
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

export async function* streamMistralBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): AsyncGenerator<ProviderStreamChunk> {
  const apiKey = getEnv("MISTRAL_API_KEY");
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
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
          content: BENCHMARK_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: buildBenchmarkUserPrompt(request)
        }
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true
    })
  });

  if (!response.ok) {
    const payload = await readProviderJson<MistralChatCompletionResponse>(response);
    throw new Error(
      payload.error?.message ??
        payload.message ??
        `Mistral API returned ${response.status}.`
    );
  }

  if (!response.body) {
    throw new Error("Mistral API returned an empty streaming body.");
  }

  yield* parseOpenAICompatibleStream(response.body);
}

export async function runMistralBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): Promise<BenchmarkResult> {
  const startedAt = performance.now();

  try {
    const apiKey = getEnv("MISTRAL_API_KEY");
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
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
            content: BENCHMARK_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildBenchmarkUserPrompt(request)
          }
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature
      })
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    const payload = await readProviderJson<MistralChatCompletionResponse>(response);

    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          payload.message ??
          `Mistral API returned ${response.status}.`
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
