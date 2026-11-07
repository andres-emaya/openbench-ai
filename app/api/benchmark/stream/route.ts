import { NextResponse } from "next/server";

import { validateBenchmarkRequest } from "@/lib/api-validation";
import {
  getBenchmarkStreamModels,
  streamMockBenchmark,
  streamModelBenchmark,
  type BenchmarkStreamEvent
} from "@/lib/benchmark-stream";
import { getBenchmarkMode, getProviderReadiness } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateBenchmarkRequest(body);

  if (!validation.ok || !validation.data) {
    return NextResponse.json(
      { error: validation.error ?? "Invalid benchmark stream request." },
      { status: 400 }
    );
  }

  const benchmarkRequest = {
    prompt: validation.data.prompt,
    maxTokens: validation.data.maxTokens ?? 512,
    temperature: validation.data.temperature ?? 0.2
  };

  const stream = new TransformStream<Uint8Array>();
  const writer = stream.writable.getWriter();
  let writeQueue = Promise.resolve();

  const send = (event: BenchmarkStreamEvent) => {
    writeQueue = writeQueue.then(() =>
      writer.write(encoder.encode(formatSseEvent(event)))
    );

    return writeQueue;
  };

  void (async () => {
    try {
      await Promise.all(
        getBenchmarkStreamModels().map(async (model) => {
          const modelStream =
            getBenchmarkMode() === "mock"
              ? streamMockBenchmark(model, benchmarkRequest.prompt)
              : streamModelBenchmark(model, benchmarkRequest.prompt, {
                  maxTokens: benchmarkRequest.maxTokens,
                  temperature: benchmarkRequest.temperature
                });

          for await (const event of modelStream) {
            if (request.signal.aborted) {
              break;
            }

            await send(event);
          }
        })
      );

      await send({
        type: "done",
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      await send({
        type: "done",
        completedAt: new Date().toISOString()
      });
      console.error("Benchmark stream failed", error);
    } finally {
      await writeQueue;
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/benchmark/stream",
    protocol: "server-sent events",
    methods: ["POST"],
    events: ["start", "token", "complete", "error", "done"],
    readiness: getProviderReadiness()
  });
}

function formatSseEvent(event: BenchmarkStreamEvent): string {
  return `event: benchmark\ndata: ${JSON.stringify(event)}\n\n`;
}
