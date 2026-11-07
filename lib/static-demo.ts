import type { BenchmarkResult } from "@/lib/benchmark";
import {
  getBenchmarkStreamModels,
  streamMockBenchmark,
  type BenchmarkStreamEvent
} from "@/lib/benchmark-stream";
import { createMockEvaluation, type EvaluationResponse } from "@/lib/evaluation";

/**
 * Static demo mode: the site is exported as plain HTML (e.g. GitHub Pages),
 * so there is no server and no API routes. The mock benchmark and the mock
 * judge run directly in the browser instead.
 */
export const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Runs the mock stream for every model at once and merges their events. */
export async function* runStaticBenchmark(
  prompt: string,
  signal: AbortSignal
): AsyncGenerator<BenchmarkStreamEvent> {
  const queue: BenchmarkStreamEvent[] = [];
  let wake: (() => void) | null = null;
  let running = 0;

  const notify = () => {
    wake?.();
    wake = null;
  };

  for (const model of getBenchmarkStreamModels()) {
    running += 1;
    void (async () => {
      try {
        for await (const event of streamMockBenchmark(model, prompt)) {
          if (signal.aborted) {
            break;
          }
          queue.push(event);
          notify();
        }
      } finally {
        running -= 1;
        notify();
      }
    })();
  }

  while (!signal.aborted) {
    if (queue.length > 0) {
      yield queue.shift() as BenchmarkStreamEvent;
      continue;
    }

    if (running === 0) {
      break;
    }

    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  }
}

/** Mock judge, same scoring the server uses in mock mode. */
export async function runStaticEvaluation(
  results: BenchmarkResult[]
): Promise<EvaluationResponse> {
  const successfulResults = results.filter(
    (result) => result.status === "success" && result.output.trim().length > 0
  );

  if (successfulResults.length === 0) {
    throw new Error("No completed model outputs are available to evaluate.");
  }

  await new Promise((resolve) => setTimeout(resolve, 600));

  return createMockEvaluation(successfulResults);
}
