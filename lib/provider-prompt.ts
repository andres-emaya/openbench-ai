import type { BenchmarkRequest } from "@/lib/benchmark";

export const BENCHMARK_SYSTEM_PROMPT =
  "You are being evaluated in a model comparison benchmark. Answer the user's exact question with a visible final answer first. For simple factual or numeric questions, be concise and add at most one verification sentence. For complex, reasoning, coding, or analysis questions, give a structured answer with the key reasoning, assumptions, caveats, and final takeaway. Do not invent facts. If uncertain, say what is uncertain.";

export function buildBenchmarkUserPrompt(request: BenchmarkRequest): string {
  return `Question:\n${request.prompt.trim()}\n\nAnswer requirements:\n- Start with the answer or conclusion.\n- Follow the user's constraints exactly.\n- Use concise reasoning when it improves correctness.\n- Do not expose private/internal reasoning.`;
}

export function isReasoningHeavyPrompt(prompt: string): boolean {
  const normalizedPrompt = prompt.toLowerCase();
  const reasoningPatterns = [
    /\b(prove|derive|reason through|logic puzzle|multi-step|counterexample)\b/,
    /\b(explain why|step by step|show your work|analyze|compare|critique)\b/,
    /\b(debug|algorithm|complexity|optimize|architecture|tradeoff)\b/,
    /\b(probability proof|statistical test|differential equation|formal proof)\b/
  ];

  return reasoningPatterns.some((pattern) => pattern.test(normalizedPrompt));
}
