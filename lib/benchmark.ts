import { runAnthropicBenchmark } from "@/lib/anthropic";
import { runDeepSeekBenchmark } from "@/lib/deepseek";
import { runGroqBenchmark } from "@/lib/groq";
import { runMistralBenchmark } from "@/lib/mistral";
import { runOpenAIBenchmark } from "@/lib/openai";
import { runTogetherBenchmark } from "@/lib/together";
import { getBenchmarkMode, getOptionalEnv } from "@/lib/env";
import { createMockBenchmarkResult } from "@/lib/results";

export type ProviderName =
  | "openai"
  | "anthropic"
  | "groq"
  | "together"
  | "mistral"
  | "deepseek";

export type BenchmarkModelId =
  | "gpt-4o"
  | "claude-sonnet"
  | "deepseek-v3"
  | "mistral-large-3";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  currency: "USD";
}

export interface BenchmarkModelConfig {
  id: BenchmarkModelId;
  provider: ProviderName;
  label: string;
  apiModel: string;
  pricing: ModelPricing;
}

export interface BenchmarkRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface BenchmarkResult {
  id: BenchmarkModelId;
  provider: ProviderName;
  label: string;
  apiModel: string;
  output: string;
  latencyMs: number;
  usage: TokenUsage;
  estimatedCostUsd: number;
  status: "success" | "error" | "streaming";
  error?: string;
  createdAt: string;
}

export interface BenchmarkSummary {
  fastestModelId: BenchmarkModelId | null;
  cheapestModelId: BenchmarkModelId | null;
  averageLatencyMs: number;
  totalEstimatedCostUsd: number;
}

export interface BenchmarkResponse {
  prompt: string;
  results: BenchmarkResult[];
  summary: BenchmarkSummary;
}

export const BENCHMARK_MODELS: BenchmarkModelConfig[] = [
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    apiModel: getOptionalEnv("OPENAI_GPT4O_MODEL", "gpt-4o"),
    pricing: {
      inputPerMillion: 2.5,
      outputPerMillion: 10,
      currency: "USD"
    }
  },
  {
    id: "claude-sonnet",
    provider: "anthropic",
    label: "Claude Sonnet",
    apiModel:
      getOptionalEnv("ANTHROPIC_CLAUDE_MODEL", "claude-sonnet-4-6"),
    pricing: {
      inputPerMillion: 3,
      outputPerMillion: 15,
      currency: "USD"
    }
  },
  {
    id: "deepseek-v3",
    provider: "deepseek",
    label: "DeepSeek V4 Pro",
    apiModel:
      getOptionalEnv("DEEPSEEK_MODEL", "deepseek-v4-pro"),
    pricing: {
      inputPerMillion: 2.1,
      outputPerMillion: 4.4,
      currency: "USD"
    }
  },
  {
    id: "mistral-large-3",
    provider: "mistral",
    label: "Mistral Large 3",
    apiModel:
      getOptionalEnv("MISTRAL_LARGE_3_MODEL", "mistral-large-2512"),
    pricing: {
      inputPerMillion: 0.5,
      outputPerMillion: 1.5,
      currency: "USD"
    }
  }
];

export async function benchmarkModels(
  prompt: string,
  options: Omit<BenchmarkRequest, "prompt"> = {}
): Promise<BenchmarkResponse> {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new Error("Prompt is required to run a benchmark.");
  }

  const request: BenchmarkRequest = {
    prompt: normalizedPrompt,
    maxTokens: options.maxTokens ?? 512,
    temperature: options.temperature ?? 0.2
  };

  const results = await Promise.all(
    BENCHMARK_MODELS.map((model) => runModelBenchmark(model, request))
  );

  return {
    prompt: normalizedPrompt,
    results,
    summary: summarizeBenchmark(results)
  };
}

async function runModelBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): Promise<BenchmarkResult> {
  if (getBenchmarkMode() === "mock") {
    return createMockBenchmarkResult(model, request.prompt);
  }

  if (model.provider === "openai") {
    return runOpenAIBenchmark(model, request);
  }

  if (model.provider === "anthropic") {
    return runAnthropicBenchmark(model, request);
  }

  if (model.provider === "together") {
    return runTogetherBenchmark(model, request);
  }

  if (model.provider === "mistral") {
    return runMistralBenchmark(model, request);
  }

  if (model.provider === "deepseek") {
    return runDeepSeekBenchmark(model, request);
  }

  return runGroqBenchmark(model, request);
}

function summarizeBenchmark(results: BenchmarkResult[]): BenchmarkSummary {
  const successfulResults = results.filter(
    (result) => result.status === "success"
  );
  const fastest = successfulResults.reduce<BenchmarkResult | null>(
    (current, result) =>
      current === null || result.latencyMs < current.latencyMs ? result : current,
    null
  );
  const cheapest = successfulResults.reduce<BenchmarkResult | null>(
    (current, result) =>
      current === null || result.estimatedCostUsd < current.estimatedCostUsd
        ? result
        : current,
    null
  );
  const averageLatencyMs =
    successfulResults.length === 0
      ? 0
      : Math.round(
          successfulResults.reduce((sum, result) => sum + result.latencyMs, 0) /
            successfulResults.length
        );

  return {
    fastestModelId: fastest?.id ?? null,
    cheapestModelId: cheapest?.id ?? null,
    averageLatencyMs,
    totalEstimatedCostUsd: Number(
      successfulResults
        .reduce((sum, result) => sum + result.estimatedCostUsd, 0)
        .toFixed(8)
    )
  };
}
