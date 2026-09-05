import type { Band, CheckDef } from './types.js'

export const CHECK_DEFS: readonly CheckDef[] = [
  {
    id: 'context-carried',
    name: 'Context carried',
    weight: 0.25,
    why: 'A constraint stated upstream has to survive the handoff. The thread that does the work only knows what the message it received says, so a cap, an id or a "do not" that the coordinator summarized away is gone for good.'
  },
  {
    id: 'no-duplicate-work',
    name: 'No duplicate work',
    weight: 0.15,
    why: 'The same tool with the same arguments from two threads, or twice in one thread with nothing changed in between, means one thread did not know what the other already had. It costs money and it hides which result the run acted on.'
  },
  {
    id: 'routing',
    name: 'Routing',
    weight: 0.2,
    why: 'A task has to go to a thread whose tools can do it. A delegation to the wrong agent produces a polite report that nothing happened, or the coordinator quietly doing the work itself.'
  },
  {
    id: 'termination',
    name: 'Termination',
    weight: 0.2,
    why: 'Every delegated thread should report back or be stopped with a reason before the coordinator answers. A thread still running behind a final answer is work the answer did not include.'
  },
  {
    id: 'permission-continuity',
    name: 'Permission continuity',
    weight: 0.2,
    why: 'An ask or a deny recorded in one thread has to hold in the next. If an escalated write executes elsewhere without its own decision, the permission model was enforced on one thread and bypassed on another.'
  }
]

export const BAND_LABELS: Record<Band, string> = {
  'handed-off': 'Handed off cleanly',
  'needs-attention': 'Handoffs need attention before this run can be trusted',
  broke: 'A handoff broke in this run'
}
