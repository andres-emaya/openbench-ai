import Link from "next/link";
import {
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  BrainCircuit,
  ClipboardList,
  Eye,
  Gauge,
  Scale,
  ShieldCheck,
  Sparkles,
  Trophy,
  Zap,
  type LucideIcon
} from "lucide-react";

const comparisonRows = [
  {
    arena: "Primarily blind pairwise preference voting.",
    openbench:
      "Blind review plus quality rubric, latency, cost, token efficiency, safety, and bias scoring."
  },
  {
    arena: "Optimized for public leaderboard signal.",
    openbench:
      "Optimized for a buyer or researcher deciding which model to use for a specific task."
  },
  {
    arena: "Great for broad human preference.",
    openbench:
      "Great for explaining tradeoffs: best answer, fastest answer, cheapest answer, and best overall value."
  },
  {
    arena: "Model ranking is the main output.",
    openbench:
      "Decision brief, round spotlight, benchmark matrix, judge rationale, and telemetry are all first-class outputs."
  }
];

const featureCards: Array<{
  icon: LucideIcon;
  label: string;
  detail: string;
}> = [
  {
    icon: Eye,
    label: "Blind Review",
    detail:
      "Read answers without model identity, reducing brand bias before reviewing scores."
  },
  {
    icon: BrainCircuit,
    label: "LLM Judge",
    detail:
      "A rubric-based judge scores reasoning, completeness, structure, safety, instruction following, and bias."
  },
  {
    icon: Gauge,
    label: "Telemetry Layer",
    detail:
      "Every run tracks latency, token usage, throughput, estimated cost, and measured efficiency."
  },
  {
    icon: ClipboardList,
    label: "Executive Brief",
    detail:
      "The dashboard explains which model is best for quality, speed, budget, and overall value."
  },
  {
    icon: ShieldCheck,
    label: "Safety Signal",
    detail:
      "Hallucination risk and bias resistance are separate scores instead of being hidden inside one grade."
  },
  {
    icon: Scale,
    label: "Open vs Closed Lens",
    detail:
      "The project is built for comparing open-source and closed-model strategy in one workflow."
  }
];

const roadmap = [
  "Human vote mode for class demos and live presentations.",
  "Exportable PDF/CSV report for professor or investor review.",
  "Prompt suite mode: run the same models across multiple tasks and average scores.",
  "Model routing recommendation: best model by budget, latency ceiling, or safety requirement."
];

export default function InsightsPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-text">
      <div className="pointer-events-none fixed inset-0 bg-terminal-grid bg-[size:44px_44px] opacity-[0.12]" />
      <div className="side-starfield side-starfield-left" aria-hidden="true" />
      <div className="side-starfield side-starfield-right" aria-hidden="true" />
      <div className="edge-rail edge-rail-left" aria-hidden="true" />
      <div className="edge-rail edge-rail-right" aria-hidden="true" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="glass-panel sticky top-4 z-20 flex items-center justify-between rounded-md px-4 py-3 shadow-inner-line">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to arena
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-medium text-blue-100">
            <Sparkles className="h-4 w-4" />
            Investor view
          </div>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="flex max-w-3xl flex-col justify-center gap-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              OpenBench AI Strategy
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              More than an arena: a model decision system.
            </h1>
            <p className="text-base leading-8 text-slate-300 sm:text-lg">
              Arena-style platforms are powerful for public preference ranking.
              OpenBench AI adds the missing product layer: measurable cost,
              speed, safety, bias, judge rationale, and buyer-ready
              recommendations for each prompt.
            </p>
          </div>

          <section className="glass-panel overflow-hidden rounded-md p-5 shadow-glow">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
                  Difference Map
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Arena vs OpenBench
                </h2>
              </div>
              <Trophy className="h-5 w-5 text-accent" />
            </div>
            <div className="grid gap-3">
              {comparisonRows.map((row) => (
                <div
                  key={row.openbench}
                  className="grid gap-3 rounded-md border border-white/10 bg-slate-950/45 p-3 md:grid-cols-2"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Typical Arena
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {row.arena}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-accent">
                      OpenBench AI
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {row.openbench}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.label}
                className="glass-panel rounded-md p-5 shadow-inner-line"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-white">{feature.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {feature.detail}
                </p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-panel rounded-md p-5 shadow-inner-line">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              Investor Angle
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Why this can stand out
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Most model comparison tools answer which response people prefer.
              OpenBench asks which model should be deployed for this job, under
              this budget, with this safety expectation. That makes
              the demo feel closer to an enterprise product than a class toy.
            </p>
          </div>

          <div className="glass-panel rounded-md p-5 shadow-inner-line">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
              Next Expansion
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Product roadmap
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {roadmap.map((item, index) => (
                <div
                  key={item}
                  className="rounded-md border border-white/10 bg-slate-950/45 p-4"
                >
                  <p className="font-mono text-xs text-accent">0{index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <InsightStat icon={BarChart3} label="Rubric" value="6 judge metrics" />
          <InsightStat icon={Zap} label="Telemetry" value="Speed + tokens" />
          <InsightStat icon={BadgeDollarSign} label="Business" value="Cost per run" />
        </section>
      </div>
    </main>
  );
}

function InsightStat({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-panel rounded-md p-4 shadow-inner-line">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-slate-950/60 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
