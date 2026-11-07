import type {
  BenchmarkModelConfig,
  BenchmarkRequest,
  BenchmarkResult,
  TokenUsage
} from "@/lib/benchmark";
import { getEnv, getOptionalEnv } from "@/lib/env";
import {
  createBenchmarkError,
  estimateCostUsd,
  readProviderJson
} from "@/lib/results";
import {
  BENCHMARK_SYSTEM_PROMPT,
  buildBenchmarkUserPrompt,
  isReasoningHeavyPrompt
} from "@/lib/provider-prompt";
import {
  type ProviderStreamChunk
} from "@/lib/stream-utils";

const DEEPSEEK_TIMEOUT_MS = 45_000;
const DEEPSEEK_MIN_OUTPUT_TOKENS = 256;
const DEEPSEEK_MAX_OUTPUT_TOKENS = 4_096;
const DEEPSEEK_THINKING_MIN_OUTPUT_TOKENS = 4_096;

interface DeepSeekChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
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

export async function* streamDeepSeekBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): AsyncGenerator<ProviderStreamChunk> {
  const result = await runDeepSeekBenchmark(model, request);

  if (result.status === "error") {
    throw new Error(result.error ?? "DeepSeek did not return an answer.");
  }

  const parts = result.output.match(/\S+\s*/g) ?? [result.output];

  for (const token of parts) {
    yield { token };
  }

  yield { usage: result.usage };
}

export async function runDeepSeekBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): Promise<BenchmarkResult> {
  const startedAt = performance.now();

  try {
    const apiKey = getEnv("DEEPSEEK_API_KEY");
    const thinkingMode = getDeepSeekThinkingMode(request.prompt);
    let response = await createDeepSeekCompletion(
      apiKey,
      model,
      request,
      false,
      thinkingMode
    );
    const latencyMs = Math.round(performance.now() - startedAt);
    let payload = await readProviderJson<DeepSeekChatCompletionResponse>(response);

    if (!response.ok) {
      throw new Error(getDeepSeekErrorMessage(payload, response.status, model.apiModel));
    }

    let output = getDeepSeekOutput(payload);

    if (!output && thinkingMode === "enabled") {
      response = await createDeepSeekCompletion(
        apiKey,
        model,
        request,
        false,
        "disabled"
      );
      payload = await readProviderJson<DeepSeekChatCompletionResponse>(response);

      if (!response.ok) {
        throw new Error(getDeepSeekErrorMessage(payload, response.status, model.apiModel));
      }

      output = getDeepSeekOutput(payload);
    }

    if (!output) {
      throw new Error(
        "DeepSeek produced internal reasoning but no final answer. The request was not scored because there was no visible response to compare."
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
      output,
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

function createDeepSeekCompletion(
  apiKey: string,
  model: BenchmarkModelConfig,
  request: BenchmarkRequest,
  stream: boolean,
  thinkingMode = getDeepSeekThinkingMode(request.prompt)
): Promise<Response> {
  const body = {
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
    max_tokens: getDeepSeekMaxTokens(request, thinkingMode),
    temperature: request.temperature,
    stream,
    thinking: {
      type: thinkingMode
    },
    ...(thinkingMode === "enabled" ? { reasoning_effort: "high" } : {})
  };

  return fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function getDeepSeekMaxTokens(
  request: BenchmarkRequest,
  thinkingMode = getDeepSeekThinkingMode(request.prompt)
): number {
  const requested = request.maxTokens ?? 512;
  const minimum =
    thinkingMode === "enabled"
      ? DEEPSEEK_THINKING_MIN_OUTPUT_TOKENS
      : DEEPSEEK_MIN_OUTPUT_TOKENS;
  const multiplier = thinkingMode === "enabled" ? 2 : 1;

  return Math.min(
    DEEPSEEK_MAX_OUTPUT_TOKENS,
    Math.max(requested * multiplier, minimum)
  );
}

function getDeepSeekThinkingMode(prompt: string): "enabled" | "disabled" {
  const mode = getOptionalEnv("DEEPSEEK_THINKING", "balanced").toLowerCase();

  if (mode === "enabled" || mode === "disabled") {
    return mode;
  }

  return isReasoningHeavyPrompt(prompt) ? "enabled" : "disabled";
}

function getDeepSeekOutput(payload: DeepSeekChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (content) {
    return content;
  }

  return "";
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEEPSEEK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        `DeepSeek API did not return a response within ${Math.round(timeoutMs / 1000)} seconds. Check DeepSeek billing/credits or try a shorter prompt.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
}

function getDeepSeekErrorMessage(
  payload: DeepSeekChatCompletionResponse,
  status: number,
  model: string
): string {
  return (
    payload.error?.message ??
    payload.message ??
    (status === 402
      ? `DeepSeek API returned 402 for ${model}. The key is valid enough to reach DeepSeek, but the DeepSeek account needs API credits/billing enabled.`
      : `DeepSeek API returned ${status} for ${model}.`)
  );
}
