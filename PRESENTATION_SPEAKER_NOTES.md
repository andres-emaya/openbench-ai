# OpenBench AI Presentation Speaker Notes

## Professor-Focused Thesis

The professor asked us to compare open and closed AI models and think about model monopoly.

My thesis is:

**OpenBench AI is not just a model benchmark. It is a transparency tool for a market where a few closed-model companies can control access, pricing, and rules.**

Closed models often win on convenience, hosted infrastructure, and reliability. Open models matter because they create competition, allow inspection and customization, and reduce dependence on one provider. My website compares them on measurable criteria instead of letting brand reputation decide.

## 1. Opening

Today I am presenting **OpenBench AI**, a web application for comparing large language models in a way that is more practical than simply asking which answer sounds best.

The core idea is simple: if I am choosing a model for a real product, I need more than popularity. I need to know quality, speed, price, token usage, safety, and whether the model actually followed the prompt.

## 2. The Problem

LLM comparison is difficult because the best-looking answer is not always the best answer. A model can be fluent but wrong, detailed but expensive, cheap but incomplete, or accurate but too slow.

There is also a monopoly problem. If a few closed companies dominate the best models, they can influence access, pricing, moderation policies, and what developers build around. Open models push back against that by giving users and researchers alternatives.

So the project asks: **how can we make model selection measurable, fair, and useful?**

## 3. The Solution

OpenBench AI lets the user enter one prompt and run it across several models: GPT-4o, Claude Sonnet, DeepSeek, and Mistral.

The app streams responses live, measures performance, anonymizes outputs for evaluation, scores them with a rubric, and then turns the results into a leaderboard and decision brief.

That means the project compares not only model intelligence, but also practical deployment tradeoffs: cost, latency, safety, and independence from one vendor.

## Open vs Closed Slide

Open models are important because they can be inspected, customized, hosted independently, and used by researchers or startups without complete dependence on one API provider.

Closed models are important because they are often more polished, easier to use, and backed by strong infrastructure. But the tradeoff is control: the provider controls the model, pricing, safety rules, and access.

The point of OpenBench AI is not to say open is always better or closed is always better. The point is to make the tradeoff visible.

## Monopoly Slide

The monopoly risk is that AI becomes a platform controlled by a few companies. If everyone builds on the same closed APIs, then those companies influence which apps can exist, how much they cost, and what behavior is allowed.

Open models are a competitive pressure. They give the ecosystem alternatives. A benchmark like OpenBench helps because it can show when an open model is good enough, cheaper, faster, or safer for a specific task.

## Interactive LLM Slide

On the LLM interaction slide, I can explain the basic pipeline:

- the prompt is split into tokens
- tokens become vectors
- attention decides which tokens matter to each other
- many layers transform the representation
- the model predicts the next token repeatedly

Then I connect it back to the project: OpenBench measures the result of that process across multiple models, instead of trusting the model name.

## 4. Architecture

The project is built with Next.js 15 and React.

On the frontend, the main dashboard handles the prompt input, streaming responses, results views, charts, blind mode, and exportable reports.

On the backend, API routes handle benchmark runs and evaluation. The provider layer supports multiple model APIs, and the environment layer checks whether each provider is configured. There is also a mock mode so the demo can still run without spending API credits or depending on network reliability.

## 5. Streaming

One technical feature I want to highlight is Server-Sent Events.

Instead of waiting for every model to finish, the `/api/benchmark/stream` endpoint sends events as each model starts, generates tokens, completes, or fails. That means users can see latency and generation behavior in real time.

This makes the app feel like a real monitoring dashboard rather than a static form.

## 6. Evaluation

The evaluation layer uses an LLM-as-judge approach, but with guardrails.

The model outputs are anonymized first, so the judge does not know whether an answer came from GPT, Claude, DeepSeek, or Mistral. Then each answer is scored across six categories:

- reasoning quality
- completeness
- structure
- low hallucination risk
- instruction following
- bias resistance

That makes the evaluation more transparent than a single unexplained score.

## 7. Arena Score

The final OpenBench score combines qualitative and quantitative signals.

Quality matters, but so do speed, cost, token efficiency, reliability, fairness, completeness, and instruction following. This is important because the "best" model depends on the context. A research task may prioritize reasoning. A production app may prioritize latency and cost. A sensitive task may prioritize hallucination risk and bias resistance.

## 8. Product Design

The interface is designed for comparison.

Blind mode helps reduce brand bias. The matrix view makes it easy to compare models side by side. The charts show latency, tokens, cost, and judge scores. The decision brief turns raw benchmark data into a recommendation.

So the user does not just get data. They get an answer to: **which model should I use for this task?**

## 9. Demo Plan

For the live demo, I would start with the bat-and-ball reasoning trap:

"A bat and ball cost $1.10 total. The bat costs $1 more than the ball. How much is the ball?"

Then I would run the benchmark, toggle blind mode, ask the room which answer seems best, and finally reveal the judge scores and telemetry.

The key teaching moment is that the best answer, fastest answer, and cheapest answer can be different.

## 10. Why It Stands Out

Many AI demos are just a prompt box connected to one model. OpenBench AI is different because it treats model selection as an engineering and product decision.

It combines API orchestration, real-time streaming, evaluation methodology, safety awareness, cost analysis, and a polished user experience.

## 11. Future Work

The next version could add prompt suites, where the same models are tested across many tasks. It could also add human voting, so we can compare class preferences against the LLM judge. Another extension is model routing, where the app automatically chooses the best model based on the user's latency, budget, or safety constraints.

## 12. Closing Line

My closing line:

**OpenBench AI does not ask which model is famous. It asks which model should actually be used.**
