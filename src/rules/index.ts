/**
 * Rule registry. Order is presentation order within checks; scoring is
 * order-independent.
 */

import type { Rule } from '../engine/types.js'
import ccNumericDropped from './cc-numeric-dropped.js'
import ccIdentifierDropped from './cc-identifier-dropped.js'
import ccNegationDropped from './cc-negation-dropped.js'
import ccReportDropped from './cc-report-dropped.js'
import dupCrossThread from './dup-cross-thread.js'
import dupSameThread from './dup-same-thread.js'
import dupAfterReport from './dup-after-report.js'
import routeToolNotHeld from './route-tool-not-held.js'
import routeTargetLacksTool from './route-target-lacks-tool.js'
import routeCoordinatorDidIt from './route-coordinator-did-it.js'
import termOrphanThread from './term-orphan-thread.js'
import termFinishedEarly from './term-finished-early.js'
import termLateReport from './term-late-report.js'
import termTerminatedWithoutReason from './term-terminated-without-reason.js'
import permEscalationBypassed from './perm-escalation-bypassed.js'
import permDenyRetried from './perm-deny-retried.js'
import permDenyRenamed from './perm-deny-renamed.js'
import permAskReused from './perm-ask-reused.js'

export const ALL_RULES: readonly Rule[] = [
  ccNumericDropped,
  ccIdentifierDropped,
  ccNegationDropped,
  ccReportDropped,
  dupCrossThread,
  dupSameThread,
  dupAfterReport,
  routeToolNotHeld,
  routeTargetLacksTool,
  routeCoordinatorDidIt,
  termOrphanThread,
  termFinishedEarly,
  termLateReport,
  termTerminatedWithoutReason,
  permEscalationBypassed,
  permDenyRetried,
  permDenyRenamed,
  permAskReused
]

export const RULE_IDS: readonly string[] = ALL_RULES.map((r) => r.id)
