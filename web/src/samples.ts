/**
 * Sample traces bundled into the page, so the parsers can be seen running in
 * the browser on real recordings. The coordinator run and the SDK run are
 * copied from agent-submit (synthetic procurement data, a placeholder buyer).
 * The broken run is synthetic and written to trip every check. The Who&When
 * shaped log is synthetic too; the real set is fetched for calibration, not
 * vendored.
 */

import type { TraceFile } from '../../src/parsers/index.js'
import type { SidecarDecision } from '../../src/parsers/managed.js'
import rosterText from '../../fixtures/agent-submit/roster.json?raw'
import brokenText from '../../fixtures/samples/broken-coordinator.json?raw'
import whowhenText from '../../tests/fixtures/whowhen-handcrafted.json?raw'
import multi from '../../fixtures/agent-submit/managed-results/results-multi.json'

const managedFiles = import.meta.glob('../../fixtures/agent-submit/managed/tc-05-coordinator/*.jsonl', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const sdkFiles = import.meta.glob('../../fixtures/agent-submit/sdk/dr-01/*', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

export interface Sample {
  label: string
  format: 'managed' | 'sdk' | 'whowhen' | 'run'
  files: TraceFile[]
  roster?: string
  decisions?: SidecarDecision[]
  note: string
}

const fileName = (path: string) => path.split('/').pop() ?? path

const coordinatorDecisions = (multi as { results: Array<{ caseId: string; decisions: SidecarDecision[] }> }).results.find((r) => r.caseId === 'tc-05')?.decisions

export const SAMPLES: Record<string, Sample> = {
  coordinator: {
    label: 'coordinator run from agent-submit (tc-05)',
    format: 'managed',
    files: Object.entries(managedFiles).map(([path, text]) => ({ name: fileName(path), text })),
    roster: rosterText,
    decisions: coordinatorDecisions,
    note: 'A recorded Claude Managed Agents session: a coordinator, a drafter and a supplier checker on a request to buy laptops from a supplier that is not on the approved list. Three per-thread files, the variant\'s decision sidecar, and the roster.'
  },
  broken: {
    label: 'a run that breaks on every check',
    format: 'run',
    files: [{ name: 'broken-coordinator.json', text: brokenText }],
    note: 'Synthetic. A coordinator drops the count, the supplier and the "do not" from the request, starts a second drafter that repeats the first one\'s lookup and executes the write the first one had held for a decision, sends the checker a drafting task, and answers while the first drafter is still waiting.'
  },
  sdk: {
    label: 'single-agent SDK control (dr-01)',
    format: 'sdk',
    files: Object.entries(sdkFiles).map(([path, text]) => ({ name: fileName(path), text })),
    note: 'A recorded agent-submit session on the Claude Agent SDK: one thread, a deferred write, a buyer decision, a resume. Every cross-thread rule is silent on it, and says so. It is the control.'
  },
  whowhen: {
    label: 'a Who&When shaped log',
    format: 'whowhen',
    files: [{ name: 'whowhen-handcrafted.json', text: whowhenText }],
    note: 'Synthetic, in the shape of the public labeled set: an orchestrator delegating to named agents, with the failing step labeled. The real set is fetched for calibration and not bundled here.'
  }
}
