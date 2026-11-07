import type { BenchmarkResult } from "@/lib/benchmark";
import type { EvaluationResponse } from "@/lib/evaluation";

export const SAMPLE_PROMPT =
  "What is 17 * 24? Explain the answer briefly.";

export const DEMO_RESULTS: BenchmarkResult[] = [
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    apiModel: "gpt-4o",
    output:
      "GPT-4o produced a concise infrastructure analysis with clear latency, reliability, and cost tradeoffs for an enterprise inference route.",
    latencyMs: 842,
    usage: {
      inputTokens: 214,
      outputTokens: 168,
      totalTokens: 382
    },
    estimatedCostUsd: 0.00221,
    status: "success",
    createdAt: "2026-05-17T17:30:00.000Z"
  },
  {
    id: "claude-sonnet",
    provider: "anthropic",
    label: "Claude Sonnet",
    apiModel: "claude-sonnet-4-6",
    output:
      "Claude emphasized governance, observability, and failure-mode analysis while maintaining a strong recommendation structure.",
    latencyMs: 1114,
    usage: {
      inputTokens: 226,
      outputTokens: 194,
      totalTokens: 420
    },
    estimatedCostUsd: 0.00359,
    status: "success",
    createdAt: "2026-05-17T17:30:01.000Z"
  },
  {
    id: "deepseek-v3",
    provider: "deepseek",
    label: "DeepSeek V4 Pro",
    apiModel: "deepseek-v4-pro",
    output:
      "DeepSeek returned a fast, direct plan focused on throughput constraints, routing policy, and batch-friendly economics.",
    latencyMs: 396,
    usage: {
      inputTokens: 212,
      outputTokens: 151,
      totalTokens: 363
    },
    estimatedCostUsd: 0.00031,
    status: "success",
    createdAt: "2026-05-17T17:30:02.000Z"
  }
];

const evaluations: EvaluationResponse["evaluations"] = [
  {
    modelId: "gpt-4o",
    label: "GPT-4o",
    normalizedScore: 91,
    verdict: "excellent",
    rationale: "Clear reasoning, complete coverage, and strong instruction adherence.",
    scores: {
      reasoningQuality: 93,
      completeness: 90,
      structure: 92,
      hallucinationRisk: 88,
      instructionFollowing: 94,
      biasResistance: 91
    }
  },
  {
    modelId: "claude-sonnet",
    label: "Claude Sonnet",
    normalizedScore: 89,
    verdict: "strong",
    rationale: "Strong structure and risk framing with thorough governance detail.",
    scores: {
      reasoningQuality: 90,
      completeness: 91,
      structure: 93,
      hallucinationRisk: 83,
      instructionFollowing: 90,
      biasResistance: 92
    }
  },
  {
    modelId: "deepseek-v3",
    label: "DeepSeek V4 Pro",
    normalizedScore: 84,
    verdict: "strong",
    rationale: "Fast and direct, though slightly less complete on operational nuance.",
    scores: {
      reasoningQuality: 85,
      completeness: 81,
      structure: 84,
      hallucinationRisk: 85,
      instructionFollowing: 86,
      biasResistance: 84
    }
  }
];

export const DEMO_EVALUATION: EvaluationResponse = {
  judgeModel: "gpt-4o-preview-judge",
  createdAt: "2026-05-17T17:31:00.000Z",
  evaluations,
  leaderboard: [...evaluations].sort(
    (left, right) => right.normalizedScore - left.normalizedScore
  )
};
