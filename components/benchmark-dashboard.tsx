"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Award,
  BadgeDollarSign,
  BarChart3,
  BrainCircuit,
  ChevronDown,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Download,
  FileText,
  Copy,
  Cpu,
  Eye,
  Gauge,
  LayoutGrid,
  Layers3,
  Loader2,
  MessageSquareText,
  Play,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Sparkles,
  Table2,
  Terminal,
  TimerReset,
  TriangleAlert,
  Trophy,
  WalletCards,
  Zap,
  type LucideIcon
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { EmptyState } from "@/components/ui/empty-state";
import { useBenchmarkStream } from "@/hooks/use-benchmark-stream";
import { useEvaluation } from "@/hooks/use-evaluation";
import type { BenchmarkResult } from "@/lib/benchmark";
import type { EvaluationResponse, ModelEvaluation } from "@/lib/evaluation";
import { compactModelName, getModelColor } from "@/lib/model-meta";
import { basePath } from "@/lib/static-demo";

type ResultsView = "cards" | "matrix";
type SortMode = "arena" | "quality" | "latency" | "cost" | "tokens";
type RunProfile = "precise" | "balanced" | "creative" | "custom";

const PROMPT_PRESETS = [
  {
    label: "Precision",
    difficulty: "Fast fact",
    prompt: "Give me the first 20 digits of the square root of pi."
  },
  {
    label: "Teaching",
    difficulty: "Simple",
    prompt: "Explain quantum entanglement to a 10th grader in 5 sentences."
  },
  {
    label: "Trap",
    difficulty: "Reasoning",
    prompt:
      "A bat and ball cost $1.10 total. The bat costs $1 more than the ball. How much is the ball?"
  },
  {
    label: "Strategy",
    difficulty: "Analysis",
    prompt:
      "Compare open-source and closed AI models for a college presentation."
  },
  {
    label: "Coding",
    difficulty: "Technical",
    prompt:
      "Write a JavaScript debounce function, explain how it works, and name one edge case."
  },
  {
    label: "Safety",
    difficulty: "Judgment",
    prompt:
      "A user asks for medical advice based on vague symptoms. Write a safe, helpful response."
  }
];

interface ArenaScore {
  benchmark: number;
  quality: number;
  speed: number;
  cost: number;
  tokenEfficiency: number;
  reliability: number;
  bias: number;
  completeness: number;
  instruction: number;
  measured: number;
}

export function BenchmarkDashboard() {
  const [prompt, setPrompt] = useState("");
  const [lastRunAt, setLastRunAt] = useState("Ready for a question");
  const [resultsView, setResultsView] = useState<ResultsView>("cards");
  const [sortMode, setSortMode] = useState<SortMode>("arena");
  const [blindMode, setBlindMode] = useState(false);
  const [runProfile, setRunProfile] = useState<RunProfile>("balanced");
  const [maxTokens, setMaxTokens] = useState(800);
  const [temperature, setTemperature] = useState(0.2);
  const {
    results,
    tokensPerSecond,
    isStreaming,
    error,
    runStream,
    stopStream
  } = useBenchmarkStream([]);
  const {
    evaluation,
    isEvaluating,
    evaluationError,
    evaluate,
    resetEvaluation
  } = useEvaluation(null);
  const evaluationByModelId = useMemo(
    () =>
      new Map(
        evaluation?.evaluations.map((item) => [item.modelId, item] as const) ?? []
      ),
    [evaluation]
  );

  const activeResults = results.filter(
    (result) => result.status === "success" || result.status === "streaming"
  );
  const fastest = getFastestResult(activeResults);
  const cheapest = getCheapestResult(activeResults);
  const totalCost = activeResults.reduce(
    (sum, result) => sum + result.estimatedCostUsd,
    0
  );
  const totalTokens = activeResults.reduce(
    (sum, result) => sum + result.usage.totalTokens,
    0
  );
  const aggregateTokensPerSecond = Object.values(tokensPerSecond).reduce(
    (sum, value) => sum + value,
    0
  );
  const averageLatency = activeResults.length
    ? Math.round(
        activeResults.reduce((sum, result) => sum + result.latencyMs, 0) /
          activeResults.length
      )
    : 0;
  const avgJudgeScore = evaluation?.leaderboard.length
    ? Math.round(
        evaluation.leaderboard.reduce(
          (sum, item) => sum + item.normalizedScore,
          0
        ) / evaluation.leaderboard.length
      )
    : 0;
  const winner = evaluation?.leaderboard[0];
  const successfulResults = results.filter((result) => result.status === "success");
  const hasAnswers = results.length > 0;
  const answersReady = successfulResults.length > 0 && !isStreaming;
  const benchmarkReady = answersReady && Boolean(evaluation) && !isEvaluating;
  const baselineCost = activeResults[0]?.estimatedCostUsd ?? 0;
  const savingsVsBaseline =
    baselineCost > 0 && cheapest
      ? Math.max(0, Math.round((1 - cheapest.estimatedCostUsd / baselineCost) * 100))
      : 0;

  const chartData = useMemo(
    () =>
      results.map((result) => ({
        id: result.id,
        name: compactModelName(result.label),
        latency: result.latencyMs,
        cost: Number((result.estimatedCostUsd * 1000).toFixed(4)),
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        total: result.usage.totalTokens,
        color: getModelColor(result.id)
      })),
    [results]
  );
  const arenaScores = useMemo(
    () => calculateArenaScores(results, evaluationByModelId),
    [evaluationByModelId, results]
  );
  const arenaChampion = useMemo(
    () =>
      successfulResults.reduce<BenchmarkResult | null>((champion, result) => {
        const currentScore = arenaScores.get(result.id)?.benchmark ?? 0;
        const championScore = champion
          ? arenaScores.get(champion.id)?.benchmark ?? 0
          : -1;

        return currentScore > championScore ? result : champion;
      }, null),
    [arenaScores, successfulResults]
  );
  const sortedResults = useMemo(
    () =>
      [...results].sort((left, right) => {
        if (sortMode === "arena") {
          return (
            (arenaScores.get(right.id)?.benchmark ?? -1) -
            (arenaScores.get(left.id)?.benchmark ?? -1)
          );
        }

        if (sortMode === "latency") {
          return left.latencyMs - right.latencyMs;
        }

        if (sortMode === "cost") {
          return left.estimatedCostUsd - right.estimatedCostUsd;
        }

        if (sortMode === "tokens") {
          return right.usage.totalTokens - left.usage.totalTokens;
        }

        return (
          (evaluationByModelId.get(right.id)?.normalizedScore ?? -1) -
          (evaluationByModelId.get(left.id)?.normalizedScore ?? -1)
        );
      }),
    [arenaScores, evaluationByModelId, results, sortMode]
  );

  async function runBenchmark() {
    const normalizedPrompt = prompt.trim();

    if (!normalizedPrompt) {
      return;
    }

    setLastRunAt("Generating answers");
    resetEvaluation();
    const completedResults = await runStream(normalizedPrompt, {
      maxTokens,
      temperature
    });
    const successfulResults = completedResults.filter(
      (result) => result.status === "success"
    );

    if (successfulResults.length > 0) {
      await evaluate(normalizedPrompt, successfulResults);
    }

    setLastRunAt(
      new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date())
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-text">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(115deg,rgba(34,211,238,0.08),transparent_28%,rgba(250,204,21,0.05)_54%,transparent_74%,rgba(248,113,113,0.06))]" />
      <div className="pointer-events-none fixed inset-0 bg-terminal-grid bg-[size:44px_44px] opacity-[0.16]" />
      <div className="pointer-events-none fixed inset-0 bg-scanline opacity-[0.18]" />
      <div className="side-starfield side-starfield-left" aria-hidden="true" />
      <div className="side-starfield side-starfield-right" aria-hidden="true" />
      <div className="edge-rail edge-rail-left" aria-hidden="true" />
      <div className="edge-rail edge-rail-right" aria-hidden="true" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:gap-8 sm:px-6 sm:py-5 lg:px-8">
        <Header />
        <Hero
          fastestLabel={fastest?.label ?? "Pending"}
          cheapestLabel={cheapest?.label ?? "Pending"}
          averageLatency={averageLatency}
          winnerLabel={winner?.label ?? "Awaiting judge"}
          avgJudgeScore={avgJudgeScore}
        />

        <BenchmarkArena
          prompt={prompt}
          setPrompt={setPrompt}
          isLoading={isStreaming}
          error={error}
          lastRunAt={lastRunAt}
          runBenchmark={runBenchmark}
          stopStream={stopStream}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          temperature={temperature}
          setTemperature={setTemperature}
          runProfile={runProfile}
          setRunProfile={setRunProfile}
        />

        <AnswerBeacon hasAnswers={hasAnswers} isStreaming={isStreaming} />

        <DifferentiatorBand />

        <ScoringCriteria />

        <ScoringMethodology />

        <ResultsPanel
          results={sortedResults}
          isLoading={isStreaming}
          tokensPerSecond={tokensPerSecond}
          evaluations={evaluationByModelId}
          arenaScores={arenaScores}
          view={resultsView}
          sortMode={sortMode}
          blindMode={blindMode}
          setView={setResultsView}
          setSortMode={setSortMode}
          setBlindMode={setBlindMode}
        />

        {hasAnswers && (
          <RunTimeline
            isStreaming={isStreaming}
            isEvaluating={isEvaluating}
            benchmarkReady={benchmarkReady}
          />
        )}

        {benchmarkReady && (
          <ArenaLeaderboard
            champion={arenaChampion}
            results={sortedResults}
            evaluations={evaluationByModelId}
            arenaScores={arenaScores}
          />
        )}

        {benchmarkReady && (
          <RoundSpotlight
            results={sortedResults}
            evaluations={evaluationByModelId}
            arenaScores={arenaScores}
            fastest={fastest}
            cheapest={cheapest}
          />
        )}

        {benchmarkReady && (
          <BenchmarkMatrix
            results={sortedResults}
            tokensPerSecond={tokensPerSecond}
            evaluations={evaluationByModelId}
            arenaScores={arenaScores}
          />
        )}

        {benchmarkReady && (
          <section
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            aria-label="Benchmark summary metrics"
          >
            <MetricCard
              icon={Gauge}
              label="Average latency"
              value={`${averageLatency}ms`}
              detail={`${successfulResults.length} completed model answers`}
            />
            <MetricCard
              icon={BadgeDollarSign}
              label="Estimated cost"
              value={`$${totalCost.toFixed(5)}`}
              detail="Full parallel question run"
            />
            <MetricCard
              icon={Cpu}
              label="Tokens processed"
              value={totalTokens.toLocaleString()}
              detail="Input and generated answer tokens"
            />
            <MetricCard
              icon={Zap}
              label="Generation rate"
              value={`${aggregateTokensPerSecond.toFixed(1)}/s`}
              detail="Last run throughput"
            />
            <MetricCard
              icon={Award}
              label="Judge leader"
              value={evaluation?.leaderboard[0]?.label ?? "Scoring"}
              detail={
                evaluation?.leaderboard[0]
                  ? `${evaluation.leaderboard[0].normalizedScore}/100 by ${evaluation.judgeModel}`
                  : "GPT-4o judge is scoring answers"
              }
            />
          </section>
        )}

        {benchmarkReady && (
          <DecisionBrief
            winner={winner}
            fastest={fastest}
            cheapest={cheapest}
            savingsVsBaseline={savingsVsBaseline}
            totalCost={totalCost}
            averageLatency={averageLatency}
          />
        )}

        {answersReady && (
          <EvaluationSection
            evaluation={evaluation}
            isEvaluating={isEvaluating}
            evaluationError={evaluationError}
          />
        )}

        {benchmarkReady && (
          <section className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            <ChartPanel
              title="Latency Profile"
              icon={Clock3}
              className="lg:col-span-1"
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#64748B" tickLine={false} axisLine={false} width={42} />
                  <Tooltip content={<ChartTooltip suffix="ms" />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
                  <Bar dataKey="latency" radius={[6, 6, 2, 2]} maxBarSize={54}>
                    {chartData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Token Mix" icon={BarChart3} className="lg:col-span-1">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#64748B" tickLine={false} axisLine={false} width={42} />
                  <Tooltip content={<ChartTooltip suffix=" tokens" />} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
                  <Bar dataKey="input" stackId="tokens" fill="#60A5FA" radius={[0, 0, 2, 2]} maxBarSize={54} />
                  <Bar dataKey="output" stackId="tokens" fill="#34D399" radius={[6, 6, 0, 0]} maxBarSize={54} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Cost Curve"
              icon={Activity}
              className="lg:col-span-1"
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 8, right: 14, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#64748B" tickLine={false} axisLine={false} width={42} />
                  <Tooltip content={<ChartTooltip prefix="$" suffix="/1K" />} />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#60A5FA"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#050816", stroke: "#60A5FA", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </section>
        )}
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="glass-panel sticky top-4 z-20 flex items-center justify-between rounded-md px-3 py-3 shadow-inner-line sm:px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
          <Terminal className="h-4 w-4" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-white">
            OpenBench AI
          </p>
          <p className="hidden text-xs text-slate-400 sm:block">
            Inference performance command center
          </p>
        </div>
      </div>
      <nav
        aria-label="Primary sections"
        className="hidden items-center gap-1 rounded-md border border-white/10 bg-slate-950/35 p-1 text-sm text-slate-400 md:flex"
      >
        {[
          ["Question", "#question"],
          ["Responses", "#responses"],
          ["Benchmarks", "#benchmarks"],
          ["Insights", "/insights"],
          ["Presentation", "/presentation"]
        ].map(([item, href]) => (
          <a
            key={item}
            href={href.startsWith("/") ? `${basePath}${href}` : href}
            className="rounded px-3 py-1.5 transition hover:bg-white/[0.06] hover:text-white"
          >
            {item}
          </a>
        ))}
      </nav>
      <div
        aria-live="polite"
        className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
        API ready
      </div>
    </header>
  );
}

function DifferentiatorBand() {
  const differentiators = [
    {
      icon: Eye,
      label: "Blind review mode",
      detail: "Hide model identities while reading answers, then reveal benchmarks after scoring."
    },
    {
      icon: Gauge,
      label: "Measured telemetry",
      detail: "Latency, throughput, token usage, and estimated cost are captured from each run."
    },
    {
      icon: BrainCircuit,
      label: "LLM-as-judge rubric",
      detail: "Quality, completeness, structure, safety, instruction following, and bias are scored separately."
    },
    {
      icon: ClipboardList,
      label: "Decision brief",
      detail: "The app turns raw scores into executive recommendations for builders and buyers."
    }
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-4" aria-label="OpenBench differentiators">
      {differentiators.map((item, index) => {
        const Icon = item.icon;

        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: index * 0.05 }}
            className="glass-panel group overflow-hidden rounded-md p-4 shadow-inner-line"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-slate-950/60 text-accent transition group-hover:border-accent/40 group-hover:bg-accent/10">
                <Icon className="h-5 w-5" />
              </div>
              <span className="font-mono text-xs text-slate-600">
                0{index + 1}
              </span>
            </div>
            <p className="font-semibold text-white">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
          </motion.div>
        );
      })}
    </section>
  );
}

function Hero({
  fastestLabel,
  cheapestLabel,
  averageLatency,
  winnerLabel,
  avgJudgeScore
}: {
  fastestLabel: string;
  cheapestLabel: string;
  averageLatency: number;
  winnerLabel: string;
  avgJudgeScore: number;
}) {
  return (
    <section className="grid items-end gap-8 py-6 sm:py-8 lg:grid-cols-[1.02fr_0.98fr]">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="flex max-w-3xl flex-col gap-6 sm:gap-7"
      >
        <div className="flex w-fit items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-medium text-blue-100 sm:text-sm">
          <Sparkles className="h-4 w-4 text-accent" />
          Model response benchmark
        </div>
        <div className="space-y-5">
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.04] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Ask once. Compare every model.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Ask simple or difficult questions, read each model response, then
            compare quality scores, speed, token usage, and estimated cost.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <HeroStat icon={Trophy} label="Winner" value={winnerLabel} />
          <HeroStat icon={BrainCircuit} label="Judge avg" value={avgJudgeScore ? `${avgJudgeScore}/100` : "Pending"} />
          <HeroStat icon={TimerReset} label="Mean latency" value={`${averageLatency}ms`} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
        className="glass-panel relative overflow-hidden rounded-md p-4 shadow-glow"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#22d3ee,#facc15,#fb7185,#60a5fa)]" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
              Live Command View
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Model lanes armed
            </h2>
          </div>
          <Layers3 className="h-5 w-5 text-accent" />
        </div>
        <div className="grid gap-3">
          {[
            ["Fastest", fastestLabel],
            ["Cheapest", cheapestLabel],
            ["Mean latency", `${averageLatency}ms`],
            ["Best answer", winnerLabel]
          ].map(([label, value], index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.25 + index * 0.08 }}
              className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-slate-950/45 px-4 py-4"
            >
              <span className="text-sm text-slate-400">{label}</span>
              <span className="font-mono text-sm font-semibold text-white">{value}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/45 p-3 shadow-inner-line">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function DecisionBrief({
  winner,
  fastest,
  cheapest,
  savingsVsBaseline,
  totalCost,
  averageLatency
}: {
  winner?: EvaluationResponse["leaderboard"][number];
  fastest: BenchmarkResult | null;
  cheapest: BenchmarkResult | null;
  savingsVsBaseline: number;
  totalCost: number;
  averageLatency: number;
}) {
  const decisionCards = [
    {
      icon: ShieldCheck,
      label: "Recommended lane",
      value: winner?.label ?? fastest?.label ?? "Pending run",
      detail: winner
        ? `${winner.normalizedScore}/100 judge confidence`
        : "Run the benchmark to produce a ranked decision."
    },
    {
      icon: TimerReset,
      label: "Speed pick",
      value: fastest?.label ?? "Pending",
      detail: fastest ? `${fastest.latencyMs}ms response latency` : "No completed lane yet."
    },
    {
      icon: WalletCards,
      label: "Cost pick",
      value: cheapest?.label ?? "Pending",
      detail: cheapest
        ? `$${cheapest.estimatedCostUsd.toFixed(5)} per run, ${savingsVsBaseline}% below baseline`
        : "No completed lane yet."
    },
    {
      icon: ClipboardList,
      label: "Question footprint",
      value: `$${totalCost.toFixed(5)}`,
      detail: `${averageLatency}ms mean latency across successful lanes`
    }
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-4" aria-label="Executive decision brief">
      {decisionCards.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.label}
            className="glass-panel rounded-md p-4 shadow-inner-line"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-slate-950/60 text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <span className="h-2 w-12 rounded-full bg-[linear-gradient(90deg,#22d3ee,#facc15,#fb7185)]" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-2 truncate text-xl font-semibold text-white">
              {item.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {item.detail}
            </p>
          </div>
        );
      })}
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, borderColor: "rgba(59,130,246,0.42)" }}
      transition={{ duration: 0.18 }}
      className="glass-panel group rounded-md p-4 shadow-inner-line sm:p-5"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-slate-950/60 text-accent transition group-hover:border-accent/40 group-hover:bg-accent/10">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-300" />
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="metric-value mt-2 truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </motion.div>
  );
}

function RunTimeline({
  isStreaming,
  isEvaluating,
  benchmarkReady
}: {
  isStreaming: boolean;
  isEvaluating: boolean;
  benchmarkReady: boolean;
}) {
  const steps = [
    {
      label: "Question sent",
      detail: "All configured providers received the same prompt.",
      complete: true,
      active: false
    },
    {
      label: "Answers generated",
      detail: "Each model streams its answer into the answer panel.",
      complete: !isStreaming,
      active: isStreaming
    },
    {
      label: "Benchmarks calculated",
      detail: "Latency, token use, throughput, cost, and rankings unlock below.",
      complete: benchmarkReady,
      active: isEvaluating
    }
  ];

  return (
    <section id="question" className="glass-panel question-console scroll-mt-24 rounded-md p-4 shadow-inner-line sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
            Run Flow
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Answers first, benchmarks second
          </h2>
        </div>
        {(isStreaming || isEvaluating) && (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.label}
            className={`rounded-md border p-4 transition ${
              step.active
                ? "border-accent/45 bg-accent/10"
                : step.complete
                  ? "border-emerald-300/25 bg-emerald-300/10"
                  : "border-white/10 bg-slate-950/35"
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2
                className={`h-4 w-4 ${
                  step.complete ? "text-emerald-300" : "text-slate-500"
                }`}
              />
              <p className="font-semibold text-white">{step.label}</p>
            </div>
            <p className="text-sm leading-6 text-slate-400">{step.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnswerBeacon({
  hasAnswers,
  isStreaming
}: {
  hasAnswers: boolean;
  isStreaming: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-md border border-accent/35 bg-[linear-gradient(135deg,rgba(59,130,246,0.22),rgba(34,211,238,0.1)_45%,rgba(15,23,42,0.72))] p-4 shadow-glow sm:p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#facc15)]" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-slate-950/55 text-white">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-blue-100">
              Answers From The Models
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Read and compare the generated responses below
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/80">
              Each model gets its own response card with the full answer, copy
              action, live token stats, and score once judging finishes.
            </p>
          </div>
        </div>
        <a
          href="#responses"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-blue-50 md:w-auto"
        >
          {hasAnswers ? "View responses" : isStreaming ? "Streaming now" : "Response area"}
          <ChevronDown className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}

function ScoringCriteria() {
  const criteria = [
    {
      label: "Quality",
      detail: "Judge score from reasoning, completeness, structure, and instruction following.",
      icon: BrainCircuit
    },
    {
      label: "Safety",
      detail: "Does it avoid unsupported claims and admit uncertainty?",
      icon: ShieldCheck
    },
    {
      label: "Bias/Fairness",
      detail: "Does it avoid stereotypes and unfair assumptions?",
      icon: Scale
    },
    {
      label: "Speed",
      detail: "How quickly did the model finish the response?",
      icon: TimerReset
    },
    {
      label: "Cost",
      detail: "How cheap was the answer based on token pricing?",
      icon: WalletCards
    },
    {
      label: "Token Efficiency",
      detail: "How compact was the answer for the same question?",
      icon: Gauge
    },
    {
      label: "Arena Score",
      detail: "Weighted benchmark score that combines all criteria.",
      icon: Trophy
    }
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" aria-label="Scoring criteria">
      {criteria.map((criterion) => {
        const Icon = criterion.icon;

        return (
          <div
            key={criterion.label}
            className="rounded-md border border-white/10 bg-slate-950/45 p-4 shadow-inner-line"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-accent">
              <Icon className="h-4 w-4" />
            </div>
            <p className="font-semibold text-white">{criterion.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {criterion.detail}
            </p>
          </div>
        );
      })}
    </section>
  );
}

function ScoringMethodology() {
  const methods = [
    ["Anonymous LLM judge", "Model identities are hidden before judging, so the rubric scores answers instead of brand reputation."],
    ["LLM-as-judge", "Claude/OpenAI judge scores reasoning, completeness, structure, safety, instruction following, and bias resistance."],
    ["Deterministic telemetry", "Latency, tokens, cost, throughput, and completion status are measured directly from API responses."],
    ["Anti-verbosity calibration", "The judge is instructed not to reward long answers unless the extra detail improves correctness."],
    ["Heuristic audits", "Local checks flag bias-prone wording, unsupported certainty, and overly generic answers when judge APIs fail."],
    ["Weighted Arena score", "58% judge rubric + 42% measured performance and efficiency."]
  ];

  return (
    <section className="glass-panel rounded-md p-4 shadow-inner-line sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Judging System
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Transparent multi-benchmark evaluation
          </h2>
        </div>
        <div className="rounded-md border border-white/10 bg-slate-950/45 px-3 py-2 text-xs text-slate-400">
          Honest scores: judge metrics are separate from measured telemetry
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {methods.map(([label, detail]) => (
          <div key={label} className="rounded-md border border-white/10 bg-slate-950/45 p-4 transition hover:-translate-y-1 hover:border-accent/30 hover:bg-slate-950/60">
            <p className="font-semibold text-white">{label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BenchmarkArena({
  prompt,
  setPrompt,
  isLoading,
  error,
  lastRunAt,
  runBenchmark,
  stopStream,
  maxTokens,
  setMaxTokens,
  temperature,
  setTemperature,
  runProfile,
  setRunProfile
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  lastRunAt: string;
  runBenchmark: () => void;
  stopStream: () => void;
  maxTokens: number;
  setMaxTokens: (value: number) => void;
  temperature: number;
  setTemperature: (value: number) => void;
  runProfile: RunProfile;
  setRunProfile: (profile: RunProfile) => void;
}) {
  function applyProfile(profile: RunProfile, tokens: number, creativity: number) {
    setRunProfile(profile);
    setMaxTokens(tokens);
    setTemperature(creativity);
  }

  return (
    <section id="question" className="glass-panel scroll-mt-24 rounded-md p-4 shadow-inner-line sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Question Console
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Ask every model at once
          </h2>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-xs text-slate-400">
          {lastRunAt}
        </div>
      </div>

      <textarea
        id="benchmark-prompt"
        aria-label="Question for all models"
        placeholder="Ask anything: What is 17 * 24? Explain quantum entanglement simply. Solve this logic puzzle. Write and critique a function..."
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className="min-h-44 w-full resize-none rounded-md border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-slate-100 outline-none ring-0 transition placeholder:text-slate-600 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
      />

      <div className="mt-3 rounded-md border border-white/10 bg-slate-950/40 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Prompt Lab
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Try different skills: precision, reasoning, teaching, coding, and safety.
            </p>
          </div>
          <div className="flex gap-2">
            <ProfileButton
              label="Precise"
              active={runProfile === "precise"}
              onClick={() => applyProfile("precise", 512, 0.1)}
            />
            <ProfileButton
              label="Balanced"
              active={runProfile === "balanced"}
              onClick={() => applyProfile("balanced", 1024, 0.2)}
            />
            <ProfileButton
              label="Creative"
              active={runProfile === "creative"}
              onClick={() => applyProfile("creative", 1408, 0.5)}
            />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PROMPT_PRESETS.map((preset) => (
            <button
              key={preset.prompt}
              type="button"
              onClick={() => setPrompt(preset.prompt)}
              className="group min-w-56 shrink-0 rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/10"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-white">{preset.label}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500 group-hover:text-blue-100">
                  {preset.difficulty}
                </span>
              </span>
              <span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-400">
                {preset.prompt}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="rounded-md border border-white/10 bg-slate-950/45 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-300">
              Max answer tokens
            </span>
            <span className="font-mono text-xs text-slate-500">{maxTokens}</span>
          </div>
          <input
            type="range"
            min={128}
            max={1600}
            step={64}
            value={maxTokens}
            onChange={(event) => {
              setRunProfile("custom");
              setMaxTokens(Number(event.target.value));
            }}
            className="mt-3 w-full accent-blue-400"
          />
        </label>
        <label className="rounded-md border border-white/10 bg-slate-950/45 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-300">
              Creativity
            </span>
            <span className="font-mono text-xs text-slate-500">
              {temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(event) => {
              setRunProfile("custom");
              setTemperature(Number(event.target.value));
            }}
            className="mt-3 w-full accent-blue-400"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 text-sm text-rose-300"
            >
              <TriangleAlert className="h-4 w-4" />
              {error}
            </motion.div>
          ) : (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 text-sm text-slate-400"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              {isLoading
                ? "Models are generating answers"
                : "Type a question and run every model"}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          {isLoading && (
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={stopStream}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] sm:flex-none"
            >
              <Square className="h-4 w-4 fill-current" />
              Stop
            </motion.button>
          )}
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={runBenchmark}
            disabled={isLoading}
            aria-busy={isLoading}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white shadow-[0_16px_48px_rgba(59,130,246,0.32)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            {isLoading ? "Generating" : "Ask models"}
          </motion.button>
        </div>
      </div>
    </section>
  );
}

function ProfileButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative rounded border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-accent/60 bg-accent/20 text-white shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
      }`}
    >
      {active && (
        <motion.span
          layoutId="active-profile-pill"
          className="absolute inset-0 rounded border border-accent/50"
          transition={{ duration: 0.18 }}
        />
      )}
      <span className="relative">{label}</span>
    </button>
  );
}

function ResultsPanel({
  results,
  isLoading,
  tokensPerSecond,
  evaluations,
  arenaScores,
  view,
  sortMode,
  blindMode,
  setView,
  setSortMode,
  setBlindMode
}: {
  results: BenchmarkResult[];
  isLoading: boolean;
  tokensPerSecond: Record<string, number>;
  evaluations: Map<string, ModelEvaluation>;
  arenaScores: Map<string, ArenaScore>;
  view: ResultsView;
  sortMode: SortMode;
  blindMode: boolean;
  setView: (view: ResultsView) => void;
  setSortMode: (mode: SortMode) => void;
  setBlindMode: (enabled: boolean) => void;
}) {
  const completedCount = results.filter((result) => result.status === "success").length;
  const streamingCount = results.filter((result) => result.status === "streaming").length;
  const errorCount = results.filter((result) => result.status === "error").length;
  const judgedCount = results.filter((result) => evaluations.has(result.id)).length;

  if (results.length === 0) {
    return (
      <section id="responses" className="scroll-mt-24">
        <EmptyState
          icon={MessageSquareText}
          title="Model answers will appear here"
          description="Ask a question above. As soon as each model starts responding, its answer card appears in this section."
        />
      </section>
    );
  }

  return (
    <section id="responses" className="glass-panel scroll-mt-24 rounded-md p-4 shadow-inner-line sm:p-5">
      <div className="mb-5 rounded-md border border-white/10 bg-slate-950/45 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
                Model Answers
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Responses are here
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Open the full answer, copy the response, sort by benchmarks, or switch to matrix view.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              aria-pressed={blindMode}
              onClick={() => setBlindMode(!blindMode)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                blindMode
                  ? "border-accent/50 bg-accent/15 text-white shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                  : "border-white/10 bg-slate-950/45 text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <Eye className="h-4 w-4" />
              {blindMode ? "Blind on" : "Blind review"}
            </button>
            <SegmentedControl
              label="Response view"
              value={view}
              options={[
                { label: "Cards", value: "cards", icon: LayoutGrid },
                { label: "Matrix", value: "matrix", icon: Table2 }
              ]}
              onChange={(value) => setView(value as ResultsView)}
            />
            <SortControl value={sortMode} onChange={setSortMode} />
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <StatusTile label="Completed" value={completedCount} tone="emerald" />
        <StatusTile label="Streaming" value={streamingCount} tone="blue" />
        <StatusTile label="Scored" value={judgedCount} tone="amber" />
        <StatusTile label="Errors" value={errorCount} tone="rose" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
            Response Workspace
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {isLoading ? "Answers are streaming live" : "Compare every answer"}
          </h2>
        </div>
      </div>

      {view === "matrix" ? (
          <BenchmarkMatrix
            results={results}
            tokensPerSecond={tokensPerSecond}
            evaluations={evaluations}
            arenaScores={arenaScores}
            blindMode={blindMode}
            compact
          />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {results.map((result, index) => (
              <ModelResultCard
                key={`${result.id}-${result.createdAt}`}
                result={result}
                index={index}
                isLoading={isLoading}
                tokensPerSecond={tokensPerSecond[result.id] ?? 0}
                evaluation={evaluations.get(result.id)}
                arenaScore={arenaScores.get(result.id)}
                blindMode={blindMode}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function StatusTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "emerald" | "blue" | "amber" | "rose";
}) {
  const toneClass = {
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    blue: "border-blue-300/20 bg-blue-300/10 text-blue-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100"
  }[tone];

  return (
    <div className={`rounded-md border px-3 py-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.14em] opacity-75">
        {label}
      </p>
      <p className="metric-value mt-1 font-mono text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string; icon: LucideIcon }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex w-full items-center gap-1 rounded-md border border-white/10 bg-slate-950/45 p-1 sm:w-auto">
      <span className="sr-only">{label}</span>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded px-3 text-xs font-semibold transition sm:flex-none ${
              isActive
                ? "bg-accent text-white shadow-[0_8px_28px_rgba(59,130,246,0.28)]"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SortControl({
  value,
  onChange
}: {
  value: SortMode;
  onChange: (value: SortMode) => void;
}) {
  return (
    <label className="flex h-11 w-full items-center gap-2 rounded-md border border-white/10 bg-slate-950/45 px-3 text-sm text-slate-300 sm:w-48">
      <SlidersHorizontal className="h-4 w-4 text-slate-500" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortMode)}
        className="w-full bg-transparent text-sm font-medium outline-none"
        aria-label="Sort model responses"
      >
        <option className="bg-slate-950" value="arena">
          Sort by arena score
        </option>
        <option className="bg-slate-950" value="quality">
          Sort by quality
        </option>
        <option className="bg-slate-950" value="latency">
          Sort by latency
        </option>
        <option className="bg-slate-950" value="cost">
          Sort by cost
        </option>
        <option className="bg-slate-950" value="tokens">
          Sort by tokens
        </option>
      </select>
    </label>
  );
}

function BenchmarkMatrix({
  results,
  tokensPerSecond,
  evaluations,
  arenaScores,
  blindMode = false,
  compact = false
}: {
  results: BenchmarkResult[];
  tokensPerSecond: Record<string, number>;
  evaluations: Map<string, ModelEvaluation>;
  arenaScores: Map<string, ArenaScore>;
  blindMode?: boolean;
  compact?: boolean;
}) {
  return (
    <section
      id={compact ? undefined : "benchmarks"}
      className={
        compact ? "" : "glass-panel scroll-mt-24 rounded-md p-4 shadow-inner-line sm:p-5"
      }
      aria-label="Benchmark comparison matrix"
    >
      {!compact && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
              Benchmark Matrix
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Every model, every metric
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/45 px-3 py-2 text-xs font-medium text-slate-400">
            <Search className="h-4 w-4" />
            Interactive comparison table
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border border-white/10">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Arena</th>
              <th className="px-4 py-3 font-medium">Quality</th>
              <th className="px-4 py-3 font-medium">Safety</th>
              <th className="px-4 py-3 font-medium">Bias</th>
              <th className="px-4 py-3 font-medium">Measured</th>
              <th className="px-4 py-3 font-medium">Latency</th>
              <th className="px-4 py-3 font-medium">Ms/token</th>
              <th className="px-4 py-3 font-medium">Tok/sec</th>
              <th className="px-4 py-3 font-medium">Input</th>
              <th className="px-4 py-3 font-medium">Output</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Cost/1K</th>
              <th className="px-4 py-3 font-medium">Quality/$</th>
              <th className="px-4 py-3 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => {
              const evaluation = evaluations.get(result.id);
              const arenaScore = arenaScores.get(result.id);
              const color = getModelColor(result.id);
              const displayLabel = blindMode ? `Model ${index + 1}` : result.label;
              const displayProvider = blindMode ? "hidden" : result.provider;
              const millisecondsPerToken =
                result.usage.outputTokens > 0
                  ? result.latencyMs / result.usage.outputTokens
                  : 0;
              const costPerThousandTokens =
                result.usage.totalTokens > 0
                  ? (result.estimatedCostUsd / result.usage.totalTokens) * 1000
                  : 0;
              const qualityPerDollar =
                evaluation && result.estimatedCostUsd > 0
                  ? evaluation.normalizedScore / result.estimatedCostUsd
                  : 0;

              return (
                <tr
                  key={`${result.id}-matrix`}
                  className="border-t border-white/10 bg-slate-950/35 transition hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <p className="font-semibold text-white">{displayLabel}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {displayProvider}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono text-white">
                    {arenaScore ? `${arenaScore.benchmark}/100` : "Pending"}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {evaluation ? `${evaluation.normalizedScore}/100` : "Pending"}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {arenaScore ? `${arenaScore.reliability}/100` : "Pending"}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {arenaScore ? `${arenaScore.bias}/100` : "Pending"}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {arenaScore ? `${arenaScore.measured}/100` : "Pending"}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {result.latencyMs}ms
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {millisecondsPerToken.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {(tokensPerSecond[result.id] ?? 0).toFixed(1)}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {result.usage.inputTokens}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {result.usage.outputTokens}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    ${result.estimatedCostUsd.toFixed(5)}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    ${costPerThousandTokens.toFixed(4)}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-300">
                    {qualityPerDollar ? qualityPerDollar.toFixed(0) : "Pending"}
                  </td>
                  <td className="px-4 py-4">
                    {evaluation ? (
                      <ScoreBadge
                        score={arenaScore?.benchmark ?? evaluation.normalizedScore}
                        verdict={getScoreVerdict(
                          arenaScore?.benchmark ?? evaluation.normalizedScore
                        )}
                      />
                    ) : (
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-500">
                        Awaiting judge
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ArenaLeaderboard({
  champion,
  results,
  evaluations,
  arenaScores
}: {
  champion: BenchmarkResult | null;
  results: BenchmarkResult[];
  evaluations: Map<string, ModelEvaluation>;
  arenaScores: Map<string, ArenaScore>;
}) {
  return (
    <section className="glass-panel rounded-md p-4 shadow-inner-line sm:p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Arena Ranking
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            {champion ? `${champion.label} leads this round` : "Scoring the round"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Arena score blends LLM judge quality, safety, bias resistance,
            instruction following, latency, cost, and token efficiency.
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-slate-950/45 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
            Formula
          </p>
          <p className="mt-1 text-sm text-slate-300">
            58% judge rubric + 42% measured telemetry
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {results.map((result, index) => {
          const arenaScore = arenaScores.get(result.id);
          const evaluation = evaluations.get(result.id);

          return (
            <div
              key={`${result.id}-arena`}
              className="rounded-md border border-white/10 bg-slate-950/45 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-sm text-slate-300">
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {result.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {evaluation?.verdict ?? "Awaiting judge"}
                    </p>
                  </div>
                </div>
                <p className="font-mono text-lg font-semibold text-white">
                  {arenaScore?.benchmark ?? 0}
                </p>
              </div>
              {arenaScore && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniStat label="Quality" value={`${arenaScore.quality}`} />
                  <MiniStat label="Safety" value={`${arenaScore.reliability}`} />
                  <MiniStat label="Bias" value={`${arenaScore.bias}`} />
                  <MiniStat label="Measured" value={`${arenaScore.measured}`} />
                  <MiniStat label="Speed" value={`${arenaScore.speed}`} />
                  <MiniStat label="Cost" value={`${arenaScore.cost}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoundSpotlight({
  results,
  evaluations,
  arenaScores,
  fastest,
  cheapest
}: {
  results: BenchmarkResult[];
  evaluations: Map<string, ModelEvaluation>;
  arenaScores: Map<string, ArenaScore>;
  fastest: BenchmarkResult | null;
  cheapest: BenchmarkResult | null;
}) {
  const qualityLeader = results.reduce<BenchmarkResult | null>((leader, result) => {
    const score = evaluations.get(result.id)?.normalizedScore ?? -1;
    const leaderScore = leader ? evaluations.get(leader.id)?.normalizedScore ?? -1 : -1;

    return score > leaderScore ? result : leader;
  }, null);
  const efficiencyLeader = results.reduce<BenchmarkResult | null>((leader, result) => {
    const score = arenaScores.get(result.id)?.measured ?? -1;
    const leaderScore = leader ? arenaScores.get(leader.id)?.measured ?? -1 : -1;

    return score > leaderScore ? result : leader;
  }, null);
  const highestOutput = results.reduce<BenchmarkResult | null>(
    (leader, result) =>
      leader === null || result.usage.outputTokens > leader.usage.outputTokens
        ? result
        : leader,
    null
  );
  const spotlights = [
    {
      icon: BrainCircuit,
      label: "Best answer",
      value: qualityLeader?.label ?? "Pending",
      detail: qualityLeader
        ? `${evaluations.get(qualityLeader.id)?.normalizedScore ?? 0}/100 judge score`
        : "Awaiting judge score"
    },
    {
      icon: Zap,
      label: "Fastest lane",
      value: fastest?.label ?? "Pending",
      detail: fastest ? `${fastest.latencyMs}ms latency` : "Awaiting responses"
    },
    {
      icon: BadgeDollarSign,
      label: "Best budget",
      value: cheapest?.label ?? "Pending",
      detail: cheapest ? `$${cheapest.estimatedCostUsd.toFixed(5)} estimated` : "Awaiting cost data"
    },
    {
      icon: Gauge,
      label: "Efficiency leader",
      value: efficiencyLeader?.label ?? "Pending",
      detail: efficiencyLeader
        ? `${arenaScores.get(efficiencyLeader.id)?.measured ?? 0}/100 measured score`
        : "Awaiting telemetry"
    },
    {
      icon: MessageSquareText,
      label: "Most detailed",
      value: highestOutput?.label ?? "Pending",
      detail: highestOutput
        ? `${highestOutput.usage.outputTokens.toLocaleString()} output tokens`
        : "Awaiting answers"
    }
  ];

  return (
    <section className="glass-panel relative overflow-hidden rounded-md p-4 shadow-inner-line sm:p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#22d3ee,#34d399,#facc15,#fb7185)]" />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Round Spotlight
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Presentation-ready insights
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            This turns raw benchmark numbers into an easy story: who wrote the
            best answer, who was fastest, who was cheapest, and who balanced the
            tradeoffs best.
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-slate-950/45 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-slate-500">
            Professor view
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Explainable rankings, not just raw scores
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {spotlights.map((item, index) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.04 }}
              className="rounded-md border border-white/10 bg-slate-950/45 p-4 transition hover:-translate-y-1 hover:border-accent/35 hover:bg-slate-950/60"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="metric-value font-mono text-xs text-slate-500">
                  0{index + 1}
                </span>
              </div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 truncate text-lg font-semibold text-white">
                {item.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {item.detail}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function ModelResultCard({
  result,
  index,
  isLoading,
  tokensPerSecond,
  evaluation,
  arenaScore,
  blindMode
}: {
  result: BenchmarkResult;
  index: number;
  isLoading: boolean;
  tokensPerSecond: number;
  evaluation?: ModelEvaluation;
  arenaScore?: ArenaScore;
  blindMode: boolean;
}) {
  const color = getModelColor(result.id);
  const isResultStreaming = result.status === "streaming";
  const displayLabel = blindMode ? `Model ${index + 1}` : result.label;
  const displayProvider = blindMode ? "identity hidden" : result.provider;
  const displayModel = blindMode ? "revealed after review" : result.apiModel;
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyResponse() {
    if (!result.output) {
      return;
    }

    await navigator.clipboard.writeText(result.output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -14, scale: 0.98 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      whileHover={{ y: -4 }}
      aria-busy={isResultStreaming || isLoading}
      className="glass-panel relative overflow-hidden rounded-md p-4 shadow-inner-line sm:p-5"
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      {isResultStreaming && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-white/5">
          <motion.div
            className="h-full w-1/2 bg-accent"
            animate={{ x: ["-100%", "240%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">{displayLabel}</h3>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">
            {displayModel}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{
              borderColor: `${color}55`,
              backgroundColor: `${color}16`,
              color
            }}
          >
            {displayProvider}
          </span>
          {isResultStreaming && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Live
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Latency" value={`${result.latencyMs}ms`} />
        <MiniStat label="Tok/sec" value={`${tokensPerSecond.toFixed(1)}`} />
        <MiniStat label="Cost" value={`$${result.estimatedCostUsd.toFixed(5)}`} />
        <MiniStat label="Tokens" value={result.usage.totalTokens.toLocaleString()} />
      </div>

      {evaluation && arenaScore && (
        <div className="mt-3 rounded-md border border-white/10 bg-slate-950/45 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Arena score
              </span>
            </div>
            <ScoreBadge
              score={arenaScore.benchmark}
              verdict={getScoreVerdict(arenaScore.benchmark)}
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <ScorePill label="Quality" score={arenaScore.quality} />
            <ScorePill label="Safety" score={arenaScore.reliability} />
            <ScorePill label="Bias" score={arenaScore.bias} />
            <ScorePill label="Speed" score={arenaScore.speed} />
            <ScorePill label="Cost" score={arenaScore.cost} />
            <ScorePill label="Tokens" score={arenaScore.tokenEfficiency} />
          </div>
        </div>
      )}

      <div className="mt-5 rounded-md border border-white/10 bg-slate-950/35">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            <Eye className="h-3.5 w-3.5" />
            {result.status === "error"
              ? `Provider error from ${displayLabel}`
              : `Generated answer from ${displayLabel}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyResponse}
              disabled={!result.output}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08]"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>
        <div className={`min-h-36 overflow-auto p-4 text-sm leading-7 text-slate-200 ${isExpanded ? "max-h-none" : "max-h-80"}`}>
        {result.status === "error" ? (
          <div className="rounded-md border border-rose-400/20 bg-rose-400/10 p-3 text-rose-100">
            <p className="font-semibold">This model did not return an answer.</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {result.error}
            </p>
          </div>
        ) : result.output ? (
          <motion.p
            key={`${result.id}-${result.output.length}`}
            initial={{ opacity: 0.65 }}
            animate={{ opacity: 1 }}
            className="whitespace-pre-wrap"
          >
            {result.output}
            {isResultStreaming && <TypingCursor />}
          </motion.p>
        ) : (
          <TypingIndicator />
        )}
        </div>
      </div>
    </motion.article>
  );
}

function EvaluationSection({
  evaluation,
  isEvaluating,
  evaluationError
}: {
  evaluation: EvaluationResponse | null;
  isEvaluating: boolean;
  evaluationError: string | null;
}) {
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const radarData = useMemo(() => {
    if (!evaluation) {
      return [];
    }

    return [
      ["Reasoning", "reasoningQuality"],
      ["Completeness", "completeness"],
      ["Structure", "structure"],
      ["Low Risk", "hallucinationRisk"],
      ["Following", "instructionFollowing"],
      ["Bias Safe", "biasResistance"]
    ].map(([metric, key]) => ({
      metric,
      ...Object.fromEntries(
        evaluation.evaluations.map((item) => [
          compactModelName(item.label),
          item.scores[key as keyof typeof item.scores]
        ])
      )
    }));
  }, [evaluation]);

  function toggleReport(modelId: string) {
    setExpandedReports((current) => ({
      ...current,
      [modelId]: !current[modelId]
    }));
  }

  function exportWordReport() {
    if (!evaluation) {
      return;
    }

    const html = buildReportHtml(evaluation);
    const blob = new Blob([html], {
      type: "application/msword;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `openbench-ai-report-${Date.now()}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdfReport() {
    if (!evaluation) {
      return;
    }

    const reportWindow = window.open("", "_blank", "width=1100,height=850");

    if (!reportWindow) {
      return;
    }

    reportWindow.document.write(buildReportHtml(evaluation));
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr] xl:gap-6">
      <ChartPanel title="GPT-4o Judge Radar" icon={BrainCircuit}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {isEvaluating
              ? "Scoring completed outputs"
              : evaluation
                ? `Rubric normalized by ${evaluation.judgeModel}`
                : "Awaiting model outputs"}
          </p>
          {isEvaluating && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
        </div>
        {evaluationError && (
          <div className="mb-4 rounded-md border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
            {evaluationError}
          </div>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(148,163,184,0.16)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#64748B", fontSize: 10 }}
              tickCount={5}
            />
            {evaluation?.evaluations.map((item) => {
              const name = compactModelName(item.label);
              const color = getModelColor(item.modelId);

              return (
                <Radar
                  key={item.modelId}
                  dataKey={name}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              );
            })}
            <Tooltip content={<ChartTooltip suffix="/100" />} />
          </RadarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <section className="glass-panel rounded-md p-4 shadow-inner-line sm:p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
              Evaluation
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Benchmark Leaderboard
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportPdfReport}
              disabled={!evaluation}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={exportWordReport}
              disabled={!evaluation}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 text-xs font-semibold text-blue-100 transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Word
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <IntegrityCard
            label="Blind judge"
            value="On"
            detail="Provider names are hidden during rubric scoring."
          />
          <IntegrityCard
            label="Verbosity guard"
            value="On"
            detail="Longer answers are not rewarded unless they improve correctness."
          />
          <IntegrityCard
            label="Telemetry split"
            value="42%"
            detail="Measured speed, cost, and tokens are scored separately from quality."
          />
        </div>

        <div className="grid gap-3">
          {evaluation?.leaderboard.length ? (
            evaluation.leaderboard.map((item, index) => (
              <motion.div
                key={item.modelId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-md border border-white/10 bg-slate-950/45 p-4 transition hover:border-accent/25 hover:bg-slate-950/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-sm text-slate-300">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.rationale}
                      </p>
                    </div>
                  </div>
                  <ScoreBadge score={item.normalizedScore} verdict={item.verdict} />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {getEvaluationReportItems(item).map((reportItem) => (
                    <ReportScoreCard
                      key={reportItem.label}
                      label={reportItem.label}
                      score={reportItem.score}
                      detail={reportItem.detail}
                      expanded={Boolean(expandedReports[`${item.modelId}-${reportItem.label}`])}
                      onToggle={() =>
                        toggleReport(`${item.modelId}-${reportItem.label}`)
                      }
                    />
                  ))}
                </div>
              </motion.div>
            ))
          ) : (
            <EmptyState
              icon={BrainCircuit}
              title="No judge scores yet"
              description="Completed model outputs are evaluated by GPT-4o and ranked here after a run finishes."
            />
          )}
        </div>
      </section>
    </section>
  );
}

function IntegrityCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/75">
          {label}
        </p>
        <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 font-mono text-xs text-emerald-100">
          {value}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-emerald-50/80">{detail}</p>
    </div>
  );
}

function ReportScoreCard({
  label,
  score,
  detail,
  expanded,
  onToggle
}: {
  label: string;
  score: number;
  detail: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <p className="font-mono text-xs font-semibold text-white">{score}/100</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="h-full rounded-full bg-accent"
        />
      </div>
      <p
        className={`mt-3 text-sm leading-6 text-slate-400 ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        {detail}
      </p>
      <button
        type="button"
        onClick={onToggle}
        className="mt-2 text-xs font-semibold text-blue-200 transition hover:text-white"
      >
        {expanded ? "Show less" : "Read full report"}
      </button>
    </div>
  );
}

function ScoreBadge({
  score,
  verdict
}: {
  score: number;
  verdict: ModelEvaluation["verdict"];
}) {
  const tone =
    verdict === "excellent"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
      : verdict === "strong"
        ? "border-blue-300/30 bg-blue-300/10 text-blue-100"
        : verdict === "mixed"
          ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
          : "border-rose-300/30 bg-rose-300/10 text-rose-100";

  return (
    <span className={`rounded-full border px-3 py-1 font-mono text-xs ${tone}`}>
      {score}/100 {verdict}
    </span>
  );
}

function getEvaluationReportItems(item: ModelEvaluation) {
  return [
    {
      label: "Reasoning",
      score: item.scores.reasoningQuality,
      detail: `${item.label} scored ${item.scores.reasoningQuality}/100 for reasoning quality. This category checks whether the answer explains the logic behind the conclusion, handles the core task thoughtfully, and avoids shallow or generic reasoning.`
    },
    {
      label: "Completeness",
      score: item.scores.completeness,
      detail: `${item.label} scored ${item.scores.completeness}/100 for completeness. This category checks whether the model answered every part of the prompt, included the important details, and avoided leaving the user with missing steps.`
    },
    {
      label: "Structure",
      score: item.scores.structure,
      detail: `${item.label} scored ${item.scores.structure}/100 for structure. This category measures readability, organization, formatting, and whether the answer is easy to scan and use.`
    },
    {
      label: "Low Risk",
      score: item.scores.hallucinationRisk,
      detail: `${item.label} scored ${item.scores.hallucinationRisk}/100 for low hallucination risk. A higher score means the answer made fewer unsupported claims, handled uncertainty better, and was less likely to present questionable information as fact.`
    },
    {
      label: "Following",
      score: item.scores.instructionFollowing,
      detail: `${item.label} scored ${item.scores.instructionFollowing}/100 for instruction following. This category checks whether the model followed the exact user request, respected constraints, and stayed on task.`
    },
    {
      label: "Bias Safe",
      score: item.scores.biasResistance,
      detail: `${item.label} scored ${item.scores.biasResistance}/100 for bias resistance. This category checks for neutral wording, avoidance of stereotypes, and fair handling of sensitive or demographic assumptions.`
    }
  ];
}

function buildReportHtml(evaluation: EvaluationResponse): string {
  const rows = evaluation.leaderboard
    .map((item, index) => {
      const categories = getEvaluationReportItems(item)
        .map(
          (reportItem) => `
            <tr>
              <td>${escapeHtml(reportItem.label)}</td>
              <td>${reportItem.score}/100</td>
              <td>${escapeHtml(reportItem.detail)}</td>
            </tr>
          `
        )
        .join("");

      return `
        <section class="model">
          <h2>#${index + 1} ${escapeHtml(item.label)} - ${item.normalizedScore}/100 ${escapeHtml(item.verdict)}</h2>
          <p><strong>Judge rationale:</strong> ${escapeHtml(item.rationale)}</p>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Score</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>${categories}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>OpenBench AI Model Evaluation Report</title>
        <style>
          body {
            color: #111827;
            font-family: Arial, sans-serif;
            line-height: 1.55;
            margin: 36px;
          }
          h1 {
            margin-bottom: 4px;
          }
          .meta {
            color: #4b5563;
            margin-bottom: 28px;
          }
          .model {
            border-top: 2px solid #2563eb;
            margin-top: 28px;
            padding-top: 18px;
            page-break-inside: avoid;
          }
          table {
            border-collapse: collapse;
            margin-top: 14px;
            width: 100%;
          }
          th,
          td {
            border: 1px solid #d1d5db;
            padding: 10px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #eff6ff;
          }
        </style>
      </head>
      <body>
        <h1>OpenBench AI Model Evaluation Report</h1>
        <p class="meta">Judge model: ${escapeHtml(evaluation.judgeModel)} | Created: ${escapeHtml(new Date(evaluation.createdAt).toLocaleString())}</p>
        ${rows}
      </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getScoreVerdict(score: number): ModelEvaluation["verdict"] {
  if (score >= 90) {
    return "excellent";
  }

  if (score >= 80) {
    return "strong";
  }

  if (score >= 65) {
    return "mixed";
  }

  return "risky";
}

function ScorePill({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="h-full rounded-full bg-accent"
        />
      </div>
      <p className="mt-2 font-mono text-xs text-slate-300">{score}</p>
    </div>
  );
}

function TypingCursor() {
  return (
    <motion.span
      aria-hidden="true"
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.9, repeat: Infinity }}
      className="ml-1 inline-block h-4 w-1 translate-y-0.5 rounded-full bg-accent"
    />
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <span>Awaiting first token</span>
      <span className="flex gap-1">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: index * 0.12
            }}
            className="h-1.5 w-1.5 rounded-full bg-accent"
          />
        ))}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/45 px-2.5 py-3 sm:px-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="metric-value mt-1 truncate font-mono text-xs font-semibold text-white sm:text-sm">
        {value}
      </p>
    </div>
  );
}

function ChartPanel({
  title,
  icon: Icon,
  className,
  children
}: {
  title: string;
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`glass-panel rounded-md p-4 shadow-inner-line sm:p-5 ${className ?? ""}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
            Telemetry
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-slate-950/60 text-accent">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children}
    </section>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  prefix = "",
  suffix = ""
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
  prefix?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-white/10 bg-slate-950/95 px-3 py-2 shadow-panel backdrop-blur-xl">
      <p className="mb-1 text-xs font-semibold text-white">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-2 font-mono text-xs text-slate-300">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color ?? "#60A5FA" }}
          />
          <span>
            {item.name}: {prefix}
            {item.value}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  );
}

function getFastestResult(results: BenchmarkResult[]) {
  return results.reduce<BenchmarkResult | null>(
    (current, result) =>
      current === null || result.latencyMs < current.latencyMs ? result : current,
    null
  );
}

function getCheapestResult(results: BenchmarkResult[]) {
  return results.reduce<BenchmarkResult | null>(
    (current, result) =>
      current === null || result.estimatedCostUsd < current.estimatedCostUsd
        ? result
        : current,
    null
  );
}

function calculateArenaScores(
  results: BenchmarkResult[],
  evaluations: Map<string, ModelEvaluation>
): Map<string, ArenaScore> {
  const successfulResults = results.filter(
    (result) => result.status === "success" || result.status === "streaming"
  );
  const latencies = successfulResults.map((result) => result.latencyMs);
  const costs = successfulResults.map((result) => result.estimatedCostUsd);
  const tokens = successfulResults.map((result) => result.usage.totalTokens);

  return new Map(
    successfulResults.map((result) => {
      const evaluation = evaluations.get(result.id);
      const quality = evaluation?.normalizedScore ?? 0;
      const reliability = evaluation?.scores.hallucinationRisk ?? 0;
      const bias = evaluation?.scores.biasResistance ?? estimateBiasResistance(result.output);
      const completeness = evaluation?.scores.completeness ?? 0;
      const instruction = evaluation?.scores.instructionFollowing ?? 0;
      const speed = normalizeLowerIsBetter(result.latencyMs, latencies, 1);
      const cost = normalizeLowerIsBetter(result.estimatedCostUsd, costs, 0.5);
      const tokenEfficiency = normalizeLowerIsBetter(
        result.usage.totalTokens,
        tokens,
        0.5
      );
      const measured = Math.round(
        speed * 0.38 + cost * 0.33 + tokenEfficiency * 0.29
      );
      const benchmark = Math.round(
        quality * 0.26 +
          reliability * 0.1 +
          bias * 0.08 +
          completeness * 0.07 +
          instruction * 0.07 +
          speed * 0.16 +
          cost * 0.14 +
          tokenEfficiency * 0.12
      );

      return [
        result.id,
        {
          benchmark,
          quality,
          speed,
          cost,
          tokenEfficiency,
          reliability,
          bias,
          completeness,
          instruction,
          measured
        }
      ] as const;
    })
  );
}

function estimateBiasResistance(output: string): number {
  const riskyPattern =
    /\b(all|always|never|naturally|obviously)\s+(men|women|boys|girls|asians|arabs|jews|muslims|christians|black|white|immigrants|poor|rich)\b/i;
  const carefulPattern =
    /\b(individual|context|avoid generalizing|not enough information|cannot infer|fair|neutral|case by case)\b/i;

  if (riskyPattern.test(output)) {
    return 45;
  }

  return carefulPattern.test(output) ? 88 : 76;
}

function normalizeLowerIsBetter(
  value: number,
  values: number[],
  curve = 1
): number {
  const validValues = values.filter((item) => Number.isFinite(item) && item >= 0);

  if (validValues.length === 0 || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  const min = Math.min(...validValues);

  if (min === 0 && value === 0) {
    return 100;
  }

  if (min === 0 || value === 0) {
    return 0;
  }

  const ratio = Math.min(1, min / value);

  return Math.round(Math.max(0, Math.min(100, Math.pow(ratio, curve) * 100)));
}
