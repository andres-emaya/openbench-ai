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
  parseAnthropicStream,
  type ProviderStreamChunk
} from "@/lib/stream-utils";

interface AnthropicMessageResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    type?: string;
    message?: string;
  };
}

const CLAUDE_FALLBACK_MODEL = "claude-sonnet-4-6";

export async function* streamAnthropicBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): AsyncGenerator<ProviderStreamChunk> {
  const apiKey = getEnv("ANTHROPIC_API_KEY");
  const response = await createAnthropicMessage(apiKey, model.apiModel, request, true);

  if (!response.ok) {
    const payload = await readProviderJson<AnthropicMessageResponse>(response);
    const message = getAnthropicErrorMessage(payload, response.status);

    if (shouldRetryClaudeFallback(model.apiModel, message)) {
      const retryResponse = await createAnthropicMessage(
        apiKey,
        CLAUDE_FALLBACK_MODEL,
        request,
        true
      );

      if (retryResponse.ok && retryResponse.body) {
        yield* parseAnthropicStream(retryResponse.body);
        return;
      }

      const retryPayload =
        await readProviderJson<AnthropicMessageResponse>(retryResponse);
      throw new Error(getAnthropicErrorMessage(retryPayload, retryResponse.status));
    }

    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Anthropic API returned an empty streaming body.");
  }

  yield* parseAnthropicStream(response.body);
}

export async function runAnthropicBenchmark(
  model: BenchmarkModelConfig,
  request: BenchmarkRequest
): Promise<BenchmarkResult> {
  const startedAt = performance.now();

  try {
    const apiKey = getEnv("ANTHROPIC_API_KEY");
    let response = await createAnthropicMessage(
      apiKey,
      model.apiModel,
      request,
      false
    );

    const latencyMs = Math.round(performance.now() - startedAt);
    let payload = await readProviderJson<AnthropicMessageResponse>(response);

    if (!response.ok) {
      const message = getAnthropicErrorMessage(payload, response.status);

      if (shouldRetryClaudeFallback(model.apiModel, message)) {
        response = await createAnthropicMessage(
          apiKey,
          CLAUDE_FALLBACK_MODEL,
          request,
          false
        );
        payload = await readProviderJson<AnthropicMessageResponse>(response);

        if (!response.ok) {
          throw new Error(getAnthropicErrorMessage(payload, response.status));
        }
      } else {
        throw new Error(message);
      }
    }

    const inputTokens = payload.usage?.input_tokens ?? 0;
    const outputTokens = payload.usage?.output_tokens ?? 0;
    const usage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };

    return {
      id: model.id,
      provider: model.provider,
      label: model.label,
      apiModel: model.apiModel,
      output:
        payload.content
          ?.filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join("\n") ?? "",
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

function createAnthropicMessage(
  apiKey: string,
  apiModel: string,
  request: BenchmarkRequest,
  stream: boolean
): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: apiModel,
      system: BENCHMARK_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildBenchmarkUserPrompt(request)
        }
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream
    })
  });
}

function getAnthropicErrorMessage(
  payload: AnthropicMessageResponse,
  status: number
): string {
  const providerMessage = payload.error?.message;

  if (!providerMessage) {
    return `Anthropic API returned ${status}.`;
  }

  if (/invalid authentication|invalid api key|authentication/i.test(providerMessage)) {
    return "Anthropic rejected ANTHROPIC_API_KEY: invalid authentication credentials. Create a new API key in the Anthropic Console, paste it into ANTHROPIC_API_KEY, save .env.local, and restart the dev server. Claude Pro/Claude.ai subscription billing is separate from Anthropic API billing.";
  }

  if (providerMessage.startsWith("model:")) {
    return `${providerMessage}. This Anthropic API key does not have that Claude model. Use ANTHROPIC_CLAUDE_MODEL=${CLAUDE_FALLBACK_MODEL}, which is listed by your Anthropic /v1/models endpoint.`;
  }

  return providerMessage;
}

function shouldRetryClaudeFallback(apiModel: string, message: string): boolean {
  return (
    apiModel !== CLAUDE_FALLBACK_MODEL &&
    apiModel.includes("claude") &&
    /model|not.?found|does not exist|invalid/i.test(message)
  );
}
