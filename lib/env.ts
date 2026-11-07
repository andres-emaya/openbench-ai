export type BenchmarkMode = "mock" | "live";

export function getBenchmarkMode(): BenchmarkMode {
  return process.env.BENCHMARK_MODE === "mock" ? "mock" : "live";
}

export function getEnv(name: string, fallback?: string): string {
  const value = (process.env[name] ?? fallback)?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getOptionalEnv(name: string, fallback: string): string {
  return (process.env[name] ?? fallback).trim();
}

export function getProviderReadiness() {
  return {
    benchmarkMode: getBenchmarkMode(),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    together: Boolean(process.env.TOGETHER_API_KEY),
    mistral: Boolean(process.env.MISTRAL_API_KEY)
  };
}
