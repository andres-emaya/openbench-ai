"use client";

import { useState } from "react";

import type { BenchmarkResult } from "@/lib/benchmark";
import type { EvaluationResponse } from "@/lib/evaluation";
import { isStaticDemo, runStaticEvaluation } from "@/lib/static-demo";

export function useEvaluation(initialEvaluation: EvaluationResponse | null = null) {
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(
    initialEvaluation
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  async function evaluate(prompt: string, results: BenchmarkResult[]) {
    setIsEvaluating(true);
    setEvaluationError(null);

    try {
      if (isStaticDemo) {
        const staticEvaluation = await runStaticEvaluation(results);
        setEvaluation(staticEvaluation);
        return staticEvaluation;
      }

      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          results
        })
      });
      const payload = (await response.json()) as
        | EvaluationResponse
        | EvaluationError;

      if (!response.ok || isEvaluationError(payload)) {
        throw new Error(
          isEvaluationError(payload)
            ? payload.error
            : "Evaluation request failed."
        );
      }

      setEvaluation(payload);
      return payload;
    } catch (error) {
      setEvaluationError(
        error instanceof Error ? error.message : "Evaluation request failed."
      );
      setEvaluation(null);
      return null;
    } finally {
      setIsEvaluating(false);
    }
  }

  function resetEvaluation() {
    setEvaluation(null);
    setEvaluationError(null);
  }

  return {
    evaluation,
    isEvaluating,
    evaluationError,
    evaluate,
    resetEvaluation
  };
}

interface EvaluationError {
  error: string;
}

function isEvaluationError(
  payload: EvaluationResponse | EvaluationError
): payload is EvaluationError {
  return "error" in payload;
}
