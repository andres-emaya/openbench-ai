import type {
  BenchmarkModelConfig,
  BenchmarkResult,
  ModelPricing,
  TokenUsage
} from "@/lib/benchmark";

export function estimateCostUsd(
  usage: TokenUsage,
  pricing: ModelPricing
): number {
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost =
    (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;

  return Number((inputCost + outputCost).toFixed(8));
}

export function createBenchmarkError(
  model: BenchmarkModelConfig,
  latencyMs: number,
  error: unknown
): BenchmarkResult {
  return {
    id: model.id,
    provider: model.provider,
    label: model.label,
    apiModel: model.apiModel,
    output: "",
    latencyMs,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    },
    estimatedCostUsd: 0,
    status: "error",
    error: error instanceof Error ? error.message : "Unknown provider error",
    createdAt: new Date().toISOString()
  };
}

export async function readProviderJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Provider returned a non-JSON response (${response.status}).`);
  }
}

export function createMockBenchmarkResult(
  model: BenchmarkModelConfig,
  prompt: string
): BenchmarkResult {
  const inputTokens = estimateTokens(prompt);
  const outputTokens = 128 + Math.round(model.label.length * 1.7);
  const usage = {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };

  return {
    id: model.id,
    provider: model.provider,
    label: model.label,
    apiModel: model.apiModel,
    output: `${model.label} mock benchmark response for: "${prompt.slice(0, 120)}"`,
    latencyMs: 300 + Math.round(Math.random() * 900),
    usage,
    estimatedCostUsd: estimateCostUsd(usage, model.pricing),
    status: "success",
    createdAt: new Date().toISOString()
  };
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}
