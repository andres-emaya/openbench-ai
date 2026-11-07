import { NextResponse } from "next/server";

import { validateEvaluationRequest } from "@/lib/api-validation";
import { evaluateModelOutputs } from "@/lib/evaluation";
import { getProviderReadiness } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateEvaluationRequest(body);

    if (!validation.ok || !validation.data) {
      return NextResponse.json(
        { error: validation.error ?? "Invalid evaluation request." },
        { status: 400 }
      );
    }

    const evaluation = await evaluateModelOutputs(
      validation.data.prompt,
      validation.data.results
    );

    return NextResponse.json(evaluation);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Evaluation request failed."
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/evaluate",
    judge: "GPT-4o",
    metrics: [
      "reasoningQuality",
      "completeness",
      "structure",
      "hallucinationRisk",
      "instructionFollowing"
    ],
    readiness: getProviderReadiness()
  });
}
