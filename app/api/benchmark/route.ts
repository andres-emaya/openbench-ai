import { NextResponse } from "next/server";

import { validateBenchmarkRequest } from "@/lib/api-validation";
import { benchmarkModels } from "@/lib/benchmark";
import { getProviderReadiness } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateBenchmarkRequest(body);

    if (!validation.ok || !validation.data) {
      return NextResponse.json(
        { error: validation.error ?? "Invalid benchmark request." },
        { status: 400 }
      );
    }

    const result = await benchmarkModels(validation.data.prompt, {
      maxTokens: validation.data.maxTokens,
      temperature: validation.data.temperature
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Benchmark request failed."
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/benchmark",
    methods: ["POST"],
    body: {
      prompt: "string",
      maxTokens: "number | optional",
      temperature: "number | optional"
    },
    readiness: getProviderReadiness()
  });
}
