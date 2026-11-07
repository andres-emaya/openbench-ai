# OpenBench AI

🔗 **Live demo:** https://andres-emaya.github.io/openbench-ai/

A web app that sends the same prompt to several large language models (GPT-4o, Claude Sonnet, DeepSeek and Mistral) and compares them side by side on quality, speed, cost and safety, instead of trusting the model name.

**Features**

- Live streaming of every model's answer (Server-Sent Events), with latency and tokens per second
- LLM-as-judge scoring on six criteria: reasoning, completeness, structure, hallucination risk, instruction following and bias resistance
- Blind review mode that hides model names to reduce brand bias
- Arena score combining answer quality with speed, cost and token efficiency
- Leaderboard, comparison matrix, charts and a decision brief

> The live demo runs in **mock mode**: answers and scores are simulated in the browser, so no API keys are needed. Run it locally with your own keys to call the real models.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. `.env.example` starts in mock mode (`BENCHMARK_MODE=mock`). To call the real models, add your API keys to `.env.local` and remove the `BENCHMARK_MODE=mock` line.

## Static build

```bash
npm run build:static
```

Builds the mock-mode demo as plain HTML in `out/`. The GitHub Actions workflow in `.github/workflows/deploy.yml` runs this and publishes it to GitHub Pages on every push to `main`.

**Built with:** Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts, Framer Motion
