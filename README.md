# Did My Agents Hand Off?

**Live:** [roanukz.github.io/agent-handoff](https://roanukz.github.io/agent-handoff/) (the teardown) and [the tool](https://roanukz.github.io/agent-handoff/tool.html).

A deterministic, no-model scorer for multi-agent traces. Five weighted checks, 18 explainable rules, and every finding cites the event ids it fired on. Runs in the browser and in the CLI with no network request.

When a multi-agent run fails, the trace shows what happened but not where the handoff broke. Published failure attribution uses a model to read the trace, which is expensive, non-deterministic, and cannot tell the person who has to fix the prompt which two lines to look at. This tool runs fixed rules that say "the drafter reported SUP-003; the coordinator's next delegation talks about the supplier without naming it" and shows the two events.

## The five checks

| Check | Weight | Asks |
|---|---|---|
| Context carried | 25% | Do the constraints stated upstream (counts, caps, ids, "do not") survive the delegation? |
| No duplicate work | 15% | Does any thread repeat a call another thread, or it, already made with the same arguments? |
| Routing | 20% | Did each task go to a thread whose declared tools can do it? |
| Termination | 20% | Did every delegated thread report back or get stopped with a reason before the final answer? |
| Permission continuity | 20% | Does an ask or a deny recorded on one thread hold on the next? |

Scoring is reused from [agent-answer](https://github.com/Roanukz/agent-answer): 25 points per major finding, 10 per minor, at most three findings per rule counted, a weighted average, and a floor so that no run is handed off cleanly with any check below 60.

## Run it

Node 20 or later.

```bash
npm install
npm test
```

Score a trace directory, a file, or a folder of either:

```bash
npm run score -- fixtures/agent-submit/managed/tc-05-coordinator
npm run score -- fixtures/agent-submit/** --events
npm run score -- some/run.json --format run --roster roster.json
```

Formats: `managed` (Claude Managed Agents per-thread JSONL: `primary.jsonl` plus one file per thread), `sdk` (the agent-submit Agent SDK record: `decisions.json`, `trail.jsonl`, `case.json`), `whowhen` (a Who&When record), `run` (this tool's own model, the shape the fixtures use). The loader detects the format from the files. A `roster.json` in an ancestor directory supplies declared tools per agent; the copied corpus carries one.

Regenerate the numbers the teardown cites:

```bash
npm run results
npm run fetch:whowhen
npm run calibrate
```

`results` scores the copied agent-submit corpus into `results/agent-submit.md`. `fetch:whowhen` downloads the public labeled set (184 records, MIT) into `data/whowhen/`, which is not committed; it is the only script in the project that opens a socket. `calibrate` writes `results/calibration.md` with precision and recall per rule.

Build the tool page into `docs/`:

```bash
npm run build
```

## Layout

- `src/model/trace.ts`: the internal trace model every parser produces and every rule reads.
- `src/parsers/`: one parser per format, plus detection.
- `src/rules/`: one file per rule. `src/rules/index.ts` is the registry.
- `src/engine/`: check definitions, text extractors, scoring.
- `src/cli/`: `score`, `results`, `calibrate`, `fetch-whowhen`.
- `fixtures/fires/` and `fixtures/quiet/`: one pair per rule, synthetic.
- `fixtures/agent-submit/`: the corpus, copied from agent-submit and its Managed Agents variant. Synthetic procurement data.
- `web/`: the tool page source. `docs/`: what Pages serves.
- `results/`: generated. Every number on the teardown comes from here, and the tests check that.
- `DECISIONS.md`: where the build followed the PRD, where it could not, and why. Gate 0, the saturation check, is at the top.

## What it is not

It does not call a model, ingest from a vendor, fix a trace, or rank frameworks. A rule that cannot run on a trace (a single thread, no tool arguments, no roster, no recorded decision) says so rather than scoring 100.

## License

MIT. See LICENSE.
