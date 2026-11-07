"use client";

import { useRef, useState } from "react";

import type { BenchmarkResult } from "@/lib/benchmark";
import type { BenchmarkStreamEvent } from "@/lib/benchmark-stream";
import { isStaticDemo, runStaticBenchmark } from "@/lib/static-demo";

interface RunStreamOptions {
  maxTokens?: number;
  temperature?: number;
}

export function useBenchmarkStream(initialResults: BenchmarkResult[]) {
  const [results, setResults] = useState<BenchmarkResult[]>(initialResults);
  const [tokensPerSecond, setTokensPerSecond] = useState<Record<string, number>>(
    {}
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runStream(prompt: string, options: RunStreamOptions = {}) {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    setResults([]);
    setTokensPerSecond({});
    setError(null);
    setIsStreaming(true);
    let latestResults: BenchmarkResult[] = [];

    try {
      if (isStaticDemo) {
        for await (const event of runStaticBenchmark(prompt, controller.signal)) {
          latestResults = applyStreamEvent(event, latestResults);
        }

        return latestResults;
      }

      const response = await fetch("/api/benchmark/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          maxTokens: options.maxTokens ?? 512,
          temperature: options.temperature ?? 0.2
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(payload?.error ?? "Benchmark stream failed.");
      }

      for await (const event of readBenchmarkEvents(response.body)) {
        if (event.type === "done") {
          break;
        }

        latestResults = applyStreamEvent(event, latestResults);
      }
    } catch (streamError) {
      if (!controller.signal.aborted) {
        setError(
          streamError instanceof Error
            ? streamError.message
            : "Benchmark stream failed."
        );
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsStreaming(false);
      }
    }

    return latestResults;
  }

  function stopStream() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }

  function applyStreamEvent(
    event: BenchmarkStreamEvent,
    currentResults: BenchmarkResult[]
  ): BenchmarkResult[] {
    if (
      event.type === "start" ||
      event.type === "token" ||
      event.type === "complete" ||
      event.type === "error"
    ) {
      const nextResults = upsertResult(currentResults, event.result);
      setResults(nextResults);
      setTokensPerSecond((current) => ({
        ...current,
        [event.result.id]: event.tokensPerSecond
      }));

      if (event.type === "error") {
        setError(event.result.error ?? null);
      }

      return nextResults;
    }

    return currentResults;
  }

  return {
    results,
    tokensPerSecond,
    isStreaming,
    error,
    runStream,
    stopStream
  };
}

async function* readBenchmarkEvents(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<BenchmarkStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split(/\r?\n\r?\n/);
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      const event = parseBenchmarkEvent(message);

      if (event) {
        yield event;
      }
    }
  }
}

function parseBenchmarkEvent(message: string): BenchmarkStreamEvent | null {
  const data = message
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, ""))
    .join("\n")
    .trim();

  if (!data) {
    return null;
  }

  return JSON.parse(data) as BenchmarkStreamEvent;
}

function upsertResult(
  results: BenchmarkResult[],
  nextResult: BenchmarkResult
): BenchmarkResult[] {
  const existingIndex = results.findIndex((result) => result.id === nextResult.id);

  if (existingIndex === -1) {
    return [...results, nextResult];
  }

  return results.map((result, index) =>
    index === existingIndex ? nextResult : result
  );
}
