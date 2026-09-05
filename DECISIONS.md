# Decisions

The PRD is `PRD - Did My Agents Hand Off (paste into new repo).md` in Roanuk's Downloads folder as of 2026-09-04. This log records where the build followed it, where it could not, and why.

## Gate 0: saturation check (2026-09-05)

The question the PRD asks: do Langfuse, LangSmith, Braintrust or AgentOps ship deterministic, no-model, explainable rules over a trace that name a handoff failure and point to the step. Docs read, not marketing.

| Tool | What the docs say | Deterministic handoff rules shipped? |
|---|---|---|
| Langfuse | [Evaluation overview](https://langfuse.com/docs/evaluation/overview) lists LLM-as-a-judge, scores via API and SDK, human annotation, and code evaluators for "deterministic checks". The [code evaluators page](https://langfuse.com/docs/evaluation/evaluation-methods/code-evaluators) says "Implement the `evaluate` function": every code evaluator is user-written, and the examples are exact match, regex, JSON parseability, schema and keyword checks. The agent graph view is a visualization. | No. |
| LangSmith | [Evaluation](https://docs.langchain.com/langsmith/evaluation) lists human review, code rules (user-written), LLM-as-judge and pairwise comparison. The [agentevals](https://github.com/langchain-ai/agentevals) library ships trajectory match evaluators (strict, unordered, subset, superset, graph strict), which are deterministic but need a reference trajectory and return a boolean, plus LLM-as-judge trajectory evaluators. [Trajectory evals](https://docs.langchain.com/langsmith/trajectory-evals) documents the same two paths. Nothing names a handoff failure or points to a step without a reference. | No. |
| Braintrust | [autoevals](https://www.braintrust.dev/docs/reference/autoevals) ships four deterministic scorers (Levenshtein, exact match, numeric difference, JSON diff) and a long list of model-based ones. [Custom code scorers](https://www.braintrust.dev/docs/evaluate/custom-code) and trace-level scorers are user-written. | No. |
| AgentOps | [The docs](https://docs.agentops.ai/) cover session replay, tracing, cost and error tracking, with integrations for AG2, AutoGen, CrewAI and the OpenAI Agents SDK. The [full index](https://docs.agentops.ai/llms.txt) has no page on evaluation, failure detection, rules or attribution. | No. |

Verdict: none of the four ships what this project builds. Every one of them offers a place to run a rule you wrote yourself, which is where a rules pack could later live. Proceed.

The published attribution work all uses a model to read the trace: Who&When (arXiv [2505.00212](https://arxiv.org/abs/2505.00212), best method 53.5 percent at agent level and 14.2 percent at step level), AgenTracer (arXiv [2509.03312](https://arxiv.org/abs/2509.03312), a trained 8B tracer), Who&When Pro (arXiv [2607.09996](https://arxiv.org/abs/2607.09996), 12,326 failed trajectories), and TraceElephant (arXiv [2604.22708](https://arxiv.org/abs/2604.22708), full traces raise attribution accuracy). Nobody publishes deterministic rules for this. That is the gap, and also the reason to expect the calibration numbers to be modest.

## Preconditions (2026-09-05)

Both met. The Managed Agents variant of agent-submit landed on 2026-09-05 at 00:28 with 112 case directories under `packages/managed-variant/traces/managed/`: 96 single-agent runs, 15 coordinator runs with per-thread streams, and one defer-and-resume run. Gate 0 is above.

## Build decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-09-05 | The agent-submit SDK parser reads `state/live/<case>/` (`trail.jsonl`, `decisions.json`, `writes.jsonl`) plus the recorded case file, not a PreToolUse/PostToolUse hook log. | agent-submit's hooks write to stderr; the persisted record of every call is `decisions.json` (classification and decision per tool-use id) and the trail. There is no hook log file to parse. |
| 2026-09-05 | The SDK corpus is a control, not a scoring corpus. It carries no tool arguments and every run is one thread. | Read tools leave only a name and a tier in the record. Four of the five checks are cross-thread by definition. The one check the SDK trail exercises is permission continuity, which is why it is kept. |
| 2026-09-05 | Managed Agents decisions come from the variant's results files (`results.json`, `results-multi.json`), joined to tool calls by case, thread and call order. Without a sidecar, a tool result with `is_error` and a rejection message reads as a deny and everything else as an allow. | The platform event stream records the call and the result, not the tier or the buyer's decision. Those live in the client that answered the call, which is where the variant wrote them. |
| 2026-09-05 | Routing rules need a roster (declared tools per agent name). `fixtures/agent-submit/roster.json` is written from the variant's `agent.ts`. Without a roster the routing rules that need one stay silent and say so. | The event stream never lists an agent's tools. Guessing them from observed calls would make "went to an agent whose tools could not do it" circular. |
| 2026-09-05 | Rule fixtures are written in the internal trace model, one `fires` and one `quiet` file per rule. Parsers get their own tests against the copied corpus. | A fixture a reviewer can read in ten lines beats a platform event stream that needs a hundred. The parsers are exercised on 121 real runs instead. |
| 2026-09-05 | The public labeled set is fetched, not vendored. `npm run fetch:whowhen` downloads the 184 files from the authors' repository into `data/whowhen/`, which is gitignored. The calibration results are committed. | The repository is MIT, but the records embed task text from GAIA and AssistantBench, whose terms are not the repository's to grant. The PRD says link rather than vendor when unclear. |
| 2026-09-05 | Who&When steps map one to one onto event ids (`step-N`). A label hits when a finding cites `step-N` or an event derived from it. | The labels index the history list from zero; verified against the labeled agent on three records before writing the parser. |
| 2026-09-05 | 18 rules, not the PRD's floor of 15. Termination and permission continuity got a fourth rule each. | A thread terminated with no reason and a deny retried under the same name are both things the PRD's check definitions describe but its starter list does not name. |
| 2026-09-05 | The teardown is `docs/index.html`, not `docs/index.md`. | Same reason as agent-submit: the house style needs the shared hero, the tokens with their dark mapping, and the contents rail. |
| 2026-09-05 | Built locally. No public repository created, nothing pushed. | Roanuk creates the public repo on his word, as with agent-submit. |

## Rule adjustments after the first pass over the corpus and the labeled set (2026-09-05)

The teardown discloses that the corpus and the public labeled set changed the rules before the reported numbers were written. This is the list. Every adjustment reduced findings; none was made by looking at which step a label named. No earlier numbers are recorded here or on the page, per the house rule on superseded builds.

| Adjustment | Prompted by | Direction |
|---|---|---|
| The "first downstream call" check requires the call's arguments to carry a value of the constraint's kind: a number for a count, a code for an identifier. A catalog lookup with no number in it is not the call that should carry "8". | Corpus: catalog lookups blamed for counts they could not take. | Fewer findings |
| `cc-report-dropped` compares identifiers only. A report's figures (a unit price, a running total) are outputs the next delegation may leave out. | Corpus: unit prices flagged as dropped constraints. | Fewer |
| Only the latest report a coordinator received counts as upstream of its next delegation, not every report it ever received. | Labeled set: orchestrators with dozens of prior reports. | Fewer |
| Constraints read from a report are limited to identifier codes and money-labeled amounts. URLs, counts, caps and negations in a report are not constraints. | Labeled set: web surfer screenshots full of links, counts and page text. | Fewer |
| An identifier with a family prefix (SUP-, CAT-, REQ-) is about its family only; its sentence neighbors are not used to decide relevance. | Fixture near miss and corpus. | Fewer |
| Duplicate pairs are consecutive: each call pairs with its most recent identical predecessor, so five repeats are four findings, not ten. | Labeled set: repeated actions producing quadratic findings. | Fewer |
| `dup-same-thread` skips tools it cannot classify as a read or a write. | Labeled set: a browser click or scroll repeated is paging. | Fewer |
| Without a recorded session end, only a message that declares a final answer counts as one. | Labeled set: an orchestrator plan mentioning "the final answer" read as the answer. | Fewer |
| `perm-deny-retried` skips a retry that was itself held for a decision. | Corpus: a rejected draft resubmitted with a new justification and approved on its own ask (db-11). | Fewer |
| `route-tool-not-held` skips sentences in which the sender says what it will do itself, and the roster no longer maps the bare word "lookup" to a tool. | Corpus: "I will validate the supplier separately" read as a request (tc-05); a name-to-id lookup mapped to the catalog tool (hp-02). | Fewer |
| "Same work" for the permission rules means the same argument keys carrying the same identifiers and numbers, not a shared draft id. | Fixture near misses: every update names its draft. | Fewer |
| A figure that is a cap ("under $12,000") is reported once, as the cap, not also as an amount. | Fixture. | Fewer |
