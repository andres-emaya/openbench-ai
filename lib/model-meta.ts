import type { BenchmarkModelId } from "@/lib/benchmark";

export const MODEL_COLORS: Record<BenchmarkModelId, string> = {
  "gpt-4o": "#60A5FA",
  "claude-sonnet": "#A78BFA",
  "deepseek-v3": "#FACC15",
  "mistral-large-3": "#FB7185"
};

export function getModelColor(modelId: BenchmarkModelId): string {
  return MODEL_COLORS[modelId] ?? "#94A3B8";
}

export function compactModelName(label: string): string {
  return label
    .replace("Claude Sonnet", "Claude")
    .replace("DeepSeek V4 Pro", "DeepSeek")
    .replace("DeepSeek-V4 Pro", "DeepSeek")
    .replace("DeepSeek-V3", "DeepSeek")
    .replace("Mistral Large 3", "Mistral");
}
