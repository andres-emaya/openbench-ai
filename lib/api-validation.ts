import type { BenchmarkRequest, BenchmarkResult } from "@/lib/benchmark";

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function validateBenchmarkRequest(body: unknown): ValidationResult<BenchmarkRequest> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return { ok: false, error: "A non-empty prompt string is required." };
  }

  return {
    ok: true,
    data: {
      prompt: body.prompt.trim(),
      maxTokens:
        typeof body.maxTokens === "number"
          ? clamp(body.maxTokens, 1, 4096)
          : undefined,
      temperature:
        typeof body.temperature === "number"
          ? clamp(body.temperature, 0, 2)
          : undefined
    }
  };
}

export function validateEvaluationRequest(
  body: unknown
): ValidationResult<{ prompt: string; results: BenchmarkResult[] }> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return { ok: false, error: "A non-empty prompt string is required." };
  }

  if (!Array.isArray(body.results) || !body.results.every(isBenchmarkResult)) {
    return { ok: false, error: "A valid benchmark results array is required." };
  }

  return {
    ok: true,
    data: {
      prompt: body.prompt.trim(),
      results: body.results
    }
  };
}

function isBenchmarkResult(value: unknown): value is BenchmarkResult {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.provider === "string" &&
    typeof value.label === "string" &&
    typeof value.apiModel === "string" &&
    typeof value.output === "string" &&
    typeof value.latencyMs === "number" &&
    isRecord(value.usage) &&
    typeof value.usage.inputTokens === "number" &&
    typeof value.usage.outputTokens === "number" &&
    typeof value.usage.totalTokens === "number" &&
    typeof value.estimatedCostUsd === "number" &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
