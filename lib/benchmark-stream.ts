import { streamAnthropicBenchmark } from "@/lib/anthropic";
import { streamDeepSeekBenchmark } from "@/lib/deepseek";
import {
  BENCHMARK_MODELS,
  type BenchmarkModelConfig,
  type BenchmarkModelId,
  type BenchmarkRequest,
  type BenchmarkResult,
  type TokenUsage
} from "@/lib/benchmark";
import { streamGroqBenchmark } from "@/lib/groq";
import { streamMistralBenchmark } from "@/lib/mistral";
import { streamOpenAIBenchmark } from "@/lib/openai";
import { streamTogetherBenchmark } from "@/lib/together";
import {
  createBenchmarkError,
  estimateCostUsd,
  estimateTokens
} from "@/lib/results";
import type { ProviderStreamChunk } from "@/lib/stream-utils";

export type BenchmarkStreamEvent =
  | {
      type: "start";
      result: BenchmarkResult;
      tokensPerSecond: number;
    }
  | {
      type: "token";
      modelId: BenchmarkModelId;
      token: string;
      result: BenchmarkResult;
      tokensPerSecond: number;
    }
  | {
      type: "complete";
      result: BenchmarkResult;
      tokensPerSecond: number;
    }
  | {
      type: "error";
      result: BenchmarkResult;
      tokensPerSecond: number;
    }
  | {
      type: "done";
      completedAt: string;
    };

export async function* streamModelBenchmark(
  model: BenchmarkModelConfig,
  prompt: string,
  options: Omit<BenchmarkRequest, "prompt"> = {}
): AsyncGenerator<BenchmarkStreamEvent> {
  const request: BenchmarkRequest = {
    prompt,
    maxTokens: options.maxTokens ?? 512,
    temperature: options.temperature ?? 0.2
  };
  const startedAt = performance.now();
  const createdAt = new Date().toISOString();
  let output = "";
  let usage: TokenUsage = {
    inputTokens: estimateTokens(prompt),
    outputTokens: 0,
    totalTokens: estimateTokens(prompt)
  };
  let result = createStreamingResult(model, output, usage, startedAt, createdAt);

  yield {
    type: "start",
    result,
    tokensPerSecond: 0
  };

  try {
    const stream = getProviderStream(model, request);

    for await (const chunk of stream) {
      if (chunk.token) {
        output += chunk.token;
      }

      usage = normalizeUsage(prompt, output, chunk, usage);
      result = createStreamingResult(model, output, usage, startedAt, createdAt);

      if (chunk.token) {
        yield {
          type: "token",
          modelId: model.id,
          token: chunk.token,
          result,
          tokensPerSecond: calculateTokensPerSecond(usage, startedAt)
        };
      }
    }

    const completedResult: BenchmarkResult = {
      ...result,
      status: "success",
      latencyMs: Math.round(performance.now() - startedAt),
      usage,
      estimatedCostUsd: estimateCostUsd(usage, model.pricing)
    };

    yield {
      type: "complete",
      result: completedResult,
      tokensPerSecond: calculateTokensPerSecond(usage, startedAt)
    };
  } catch (error) {
    const errorResult = createBenchmarkError(
      model,
      Math.round(performance.now() - startedAt),
      error
    );

    yield {
      type: "error",
      result: errorResult,
      tokensPerSecond: 0
    };
  }
}

export async function* streamMockBenchmark(
  model: BenchmarkModelConfig,
  prompt: string
): AsyncGenerator<BenchmarkStreamEvent> {
  const startedAt = performance.now();
  const createdAt = new Date().toISOString();
  let output = "";
  let usage: TokenUsage = {
    inputTokens: estimateTokens(prompt),
    outputTokens: 0,
    totalTokens: estimateTokens(prompt)
  };

  yield {
    type: "start",
    result: createStreamingResult(model, output, usage, startedAt, createdAt),
    tokensPerSecond: 0
  };

  const sample = createMockModelAnswer(model, prompt);
  const parts = sample.match(/\S+\s*/g) ?? [sample];

  for (const token of parts) {
    await delay(45 + Math.random() * 55);
    output += token;
    usage = {
      inputTokens: estimateTokens(prompt),
      outputTokens: estimateTokens(output),
      totalTokens: estimateTokens(prompt) + estimateTokens(output)
    };

    yield {
      type: "token",
      modelId: model.id,
      token,
      result: createStreamingResult(model, output, usage, startedAt, createdAt),
      tokensPerSecond: calculateTokensPerSecond(usage, startedAt)
    };
  }

  yield {
    type: "complete",
    result: {
      ...createStreamingResult(model, output, usage, startedAt, createdAt),
      status: "success"
    },
    tokensPerSecond: calculateTokensPerSecond(usage, startedAt)
  };
}

export function getBenchmarkStreamModels() {
  return BENCHMARK_MODELS;
}

function getProviderStream(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): AsyncGenerator<ProviderStreamChunk> {
  if (model.provider === "openai") {
    return streamOpenAIBenchmark(model, request);
  }

  if (model.provider === "anthropic") {
    return streamAnthropicBenchmark(model, request);
  }

  if (model.provider === "together") {
    return streamTogetherBenchmark(model, request);
  }

  if (model.provider === "mistral") {
    return streamMistralBenchmark(model, request);
  }

  if (model.provider === "deepseek") {
    return streamDeepSeekBenchmark(model, request);
  }

  return streamGroqBenchmark(model, request);
}

function createStreamingResult(
  model: BenchmarkModelConfig,
  output: string,
  usage: TokenUsage,
  startedAt: number,
  createdAt: string
): BenchmarkResult {
  return {
    id: model.id,
    provider: model.provider,
    label: model.label,
    apiModel: model.apiModel,
    output,
    latencyMs: Math.round(performance.now() - startedAt),
    usage,
    estimatedCostUsd: estimateCostUsd(usage, model.pricing),
    status: "streaming",
    createdAt
  };
}

function normalizeUsage(
  prompt: string,
  output: string,
  chunk: ProviderStreamChunk,
  currentUsage: TokenUsage
): TokenUsage {
  const inputTokens =
    chunk.usage?.inputTokens || currentUsage.inputTokens || estimateTokens(prompt);
  const estimatedOutputTokens = estimateTokens(output);
  const outputTokens = Math.max(
    chunk.usage?.outputTokens ?? 0,
    currentUsage.outputTokens,
    estimatedOutputTokens
  );

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}

function calculateTokensPerSecond(usage: TokenUsage, startedAt: number): number {
  const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
  return Number((usage.outputTokens / seconds).toFixed(1));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockModelAnswer(
  model: BenchmarkModelConfig,
  prompt: string
): string {
  const arithmeticAnswer = answerSimpleArithmetic(prompt);
  const normalizedPrompt = prompt.trim();
  const isShortQuestion = normalizedPrompt.length < 90;
  const styleByModel: Record<BenchmarkModelId, string> = {
    "gpt-4o": "I will answer directly, then add a short explanation.",
    "claude-sonnet":
      "I will be careful about assumptions and show the reasoning in steps.",
    "deepseek-v3": "I will focus on reasoning and concise execution.",
    "mistral-large-3": "I will answer with structured, general-purpose analysis."
  };

  if (arithmeticAnswer) {
    const explanations: Record<BenchmarkModelId, string> = {
      "gpt-4o": `Answer: ${arithmeticAnswer.result}. ${arithmeticAnswer.left} ${arithmeticAnswer.operator} ${arithmeticAnswer.right} equals ${arithmeticAnswer.result}.`,
      "claude-sonnet": `The answer is ${arithmeticAnswer.result}. Step by step: take ${arithmeticAnswer.left}, apply ${arithmeticAnswer.operator} with ${arithmeticAnswer.right}, and the result is ${arithmeticAnswer.result}.`,
      "deepseek-v3": `${arithmeticAnswer.left} ${arithmeticAnswer.operator} ${arithmeticAnswer.right} = ${arithmeticAnswer.result}.`,
      "mistral-large-3": `The computed result is ${arithmeticAnswer.result}.`
    };

    return explanations[model.id];
  }

  const answerBodies: Record<BenchmarkModelId, string> = {
    "gpt-4o": isShortQuestion
      ? `Direct answer: ${normalizedPrompt}\n\nI would answer this by identifying the main fact or operation being requested, giving the result first, and adding only the explanation needed to verify it.`
      : `Direct answer:\nThe strongest response should address the full question, separate assumptions from conclusions, and give a concrete final recommendation.\n\nMy approach:\n1. Restate the goal in plain language.\n2. Solve the central task first.\n3. Add caveats only where the answer depends on missing information.`,
    "claude-sonnet": isShortQuestion
      ? `Careful answer:\nI would first check whether the question has enough information to answer safely. If it does, I would answer directly; if not, I would state the missing assumption before continuing.`
      : `Structured answer:\nA good response should be explicit about assumptions, handle edge cases, and avoid making claims beyond the prompt.\n\nI would organize the answer into: answer, reasoning, limitations, and final takeaway.`,
    "deepseek-v3": isShortQuestion
      ? `Reasoning-focused answer:\nGive the direct answer and include the minimum reasoning needed to verify it.`
      : `Reasoning answer:\nSeparate the problem into premises, inference steps, and conclusion. Prioritize correctness over polish.`,
    "mistral-large-3": isShortQuestion
      ? `Structured answer:\nGive a clear answer first, then a short supporting explanation.`
      : `Generalist answer:\nProvide a structured answer with definitions, reasoning, and a concise final takeaway.`
  };

  return `${styleByModel[model.id]}\n\n${answerBodies[model.id]}`;
}

function answerSimpleArithmetic(prompt: string):
  | {
      left: number;
      right: number;
      operator: string;
      result: number;
    }
  | null {
  const match = prompt.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/x×])\s*(-?\d+(?:\.\d+)?)/);

  if (!match) {
    return null;
  }

  const left = Number(match[1]);
  const operator = match[2];
  const right = Number(match[3]);
  let result: number;

  if (operator === "+") {
    result = left + right;
  } else if (operator === "-") {
    result = left - right;
  } else if (operator === "*" || operator === "x" || operator === "×") {
    result = left * right;
  } else if (operator === "/" && right !== 0) {
    result = left / right;
  } else {
    return null;
  }

  return {
    left,
    right,
    operator,
    result: Number(result.toFixed(6))
  };
}
