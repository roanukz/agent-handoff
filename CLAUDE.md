# Did My Agents Hand Off?

A deterministic, no-model scorer for multi-agent traces. Five weighted checks,
explainable rules, every finding cites the event ids it fired on. Runs in the
browser and in the CLI with no network request. Sibling of `agent-answer`
(same rule engine and page skeleton) and `agent-submit` (the trace corpus).

## The hard invariant: no model, no network

Nothing in this repository calls a model or makes a network request, in the
page, the CLI, the tests or the rules. The one exception is
`npm run fetch:whowhen`, which downloads the public labeled set once so the
calibration can run; that script is the only file allowed to open a socket.
The page enforces the promise with a Content Security Policy, and
`tests/style.test.ts` checks the built page and the rules for anything that
looks like a request.

## Layout

- `src/model/trace.ts`: the internal trace model every parser produces and every rule reads.
- `src/parsers/`: `managed.ts` (Claude Managed Agents per-thread JSONL), `sdk-hooklog.ts` (the agent-submit Agent SDK trail), `whowhen.ts` (the public labeled set), `run-json.ts` (the internal model as a file).
- `src/rules/`: one file per rule, registered in `src/rules/index.ts`.
- `src/engine/`: check definitions, weighting and scoring, reused from agent-answer with spans replaced by event ids.
- `src/cli/`: `score`, `calibrate`, `results`, `fetch-whowhen`.
- `fixtures/fires/` and `fixtures/quiet/`: one pair per rule, in the internal model, synthetic data only.
- `fixtures/agent-submit/`: the copied corpus. `sdk/` holds the SDK runs, `managed/` the Managed Agents runs, `managed-results/` the decision sidecars, `roster.json` the declared tools per agent.
- `web/`: the tool page source. `npm run build` writes it into `docs/` beside the hand-written teardown.
- `docs/`: what Pages serves. `index.html` is the teardown, `tool.html` the tool.
- `results/`: generated tables. Every number on the teardown comes from a file here.

## House rules

- US spelling everywhere, including identifiers and comments. `tests/spelling.test.ts` walks the repo.
- No em or en dashes anywhere a reader or a maintainer sees. `tests/style.test.ts` walks the repo.
- Say "cut" when dropping scope, never the harsher verb.
- No employer, client or vendor names or numbers.
- Fixtures are synthetic. The copied corpus is synthetic procurement data with a placeholder buyer.
- A number on the teardown is generated, never typed. If the results change, rerun `npm run results` and `npm run calibrate` and let the tests tell you what the page now disagrees with.
- Do not report a superseded build's results. When a rule is fixed, the fixed run is the only run.
- Decisions that deviate from the PRD go in `DECISIONS.md`, with the reason.
