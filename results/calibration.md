# Calibration against Who&When

Generated 2026-09-05T05:26:21.760Z by `npm run calibrate` over 184 labeled failure records (58 Hand-Crafted, 126 Algorithm-Generated). Mean 22.2 steps per record; a rule that picked one step at random would hit the labeled step 4.5% of the time.

Labels mark the failing step and agent, not the failure kind. "Hit" means a finding cites the labeled step's event (or the action derived from it). Recall is measured against the reason-to-check mapping below, which is a keyword map over the free-text reason and is published here so the number can be argued with.

| Measure | Value |
|---|---|
| Records where some rule cites the labeled step | 3 of 184 (1.6%) |
| Records where some rule cites an event in the labeled agent's thread | 24 of 184 (13%) |
| Records with at least one finding | 27 |
| Records where every rule was silent for lack of structure | 25 |
| Findings per record | 0.6 |
| Records whose reason maps to no check | 91 |

## Per rule

| Rule | Check | Records fired | Findings | TP | FP | FN | Mapped records | Precision | Recall |
|---|---|---|---|---|---|---|---|---|---|
| cc-numeric-dropped | context-carried | 20 | 94 | 2 | 18 | 28 | 28 | 10% | 0% |
| cc-identifier-dropped | context-carried | 2 | 7 | 0 | 2 | 28 | 28 | 0% | 0% |
| cc-negation-dropped | context-carried | 1 | 5 | 0 | 1 | 28 | 28 | 0% | 0% |
| cc-report-dropped | context-carried | 0 | 0 | 0 | 0 | 28 | 28 | n/a | 0% |
| dup-cross-thread | no-duplicate-work | 4 | 4 | 1 | 3 | 2 | 3 | 25% | 33.3% |
| dup-same-thread | no-duplicate-work | 0 | 0 | 0 | 0 | 3 | 3 | n/a | 0% |
| dup-after-report | no-duplicate-work | 0 | 0 | 0 | 0 | 3 | 3 | n/a | 0% |
| route-tool-not-held | routing | 0 | 0 | 0 | 0 | 29 | 29 | n/a | 0% |
| route-target-lacks-tool | routing | 0 | 0 | 0 | 0 | 29 | 29 | n/a | 0% |
| route-coordinator-did-it | routing | 0 | 0 | 0 | 0 | 29 | 29 | n/a | 0% |
| term-orphan-thread | termination | 1 | 1 | 0 | 1 | 57 | 57 | 0% | 0% |
| term-finished-early | termination | 0 | 0 | 0 | 0 | 57 | 57 | n/a | 0% |
| term-late-report | termination | 0 | 0 | 0 | 0 | 57 | 57 | n/a | 0% |
| term-terminated-without-reason | termination | 0 | 0 | 0 | 0 | 57 | 57 | n/a | 0% |
| perm-escalation-bypassed | permission-continuity | 0 | 0 | 0 | 0 | 0 | 0 | n/a | n/a |
| perm-deny-retried | permission-continuity | 0 | 0 | 0 | 0 | 0 | 0 | n/a | n/a |
| perm-deny-renamed | permission-continuity | 0 | 0 | 0 | 0 | 0 | 0 | n/a | n/a |
| perm-ask-reused | permission-continuity | 0 | 0 | 0 | 0 | 0 | 0 | n/a | n/a |

Precision: of the records where the rule fired, the share where a finding cites the labeled step. Recall: of the records whose reason maps to the rule's check, the share where this rule cites the labeled step. n/a means the denominator is zero.

## Per check

| Check | Records mapped to it | Fired on those | Cited the labeled step on those |
|---|---|---|---|
| context-carried | 28 | 2 | 0 |
| no-duplicate-work | 3 | 1 | 1 |
| routing | 29 | 0 | 0 |
| termination | 57 | 1 | 0 |
| permission-continuity | 0 | 0 | 0 |

## The reason-to-check mapping

- **context-carried**: `ignor|overlook|forg[eo]t|omit|dropp?|miss(?:ed|es|ing)? (?:the |a |an )?(?:constraint|requirement|detail|instruction|condition|criteri|specif)|(?:did not|didn't|does not|doesn't|not) (?:include|consider|follow|account for|pass|use the (?:provided|given)|take into account)|criteri|constraint|requirement|misunderst|misinterpret|incorrect(?:ly)? (?:interpret|assum|understood)|wrong (?:assumption|parameter|input|value|keyword|query|search term)|keyword|search term|hallucinat|fabricat|made up|assum(?:ed|es|ing) (?:that|the|a)`
- **no-duplicate-work**: `repeat|again|redundant|same (?:search|query|action|code|request|step|page)|loop|duplicate|re-?run|once more|stuck`
- **routing**: `wrong (?:agent|tool|expert|direction|website|source)|should (?:have )?(?:use|ask|delegat|instruct|call|assign|let|refer|visit)|delegat|instruct|navigat\w* the agents|third-party|instead|inappropriate|irrelevant (?:website|page|tool|link|source)|not (?:the )?(?:right|appropriate|correct) (?:agent|tool|expert|website|source)|(?:tool|function|website|search) (?:it|that|does|doesn't|cannot|can't|is not)|rel(?:y|ies|ied|ys) on`
- **termination**: `terminat|stop(?:ped|s)? (?:early|prematurely|before)|prematur|(?:did not|didn't|does not|doesn't) (?:report|return|finish|complete|verify|check|continue|wait|retrieve|extract|provide|find|actually)|gave up|incomplete|not (?:yet )?(?:been )?(?:fully )?(?:complet|address|gather|satisf)|has not yet|without (?:finishing|verifying|completing|checking|confirming|performing|gathering)|ended (?:the|without)|conclu(?:de|sion)|directly (?:reach|conclud|provid|answer|g[ai]ve|draw)|draw a conclusion|no further|halt|guess|not (?:fully )?shown|only displayed|failed to (?:access|retrieve|extract|find|provide|transcribe|locate|return)|unable to|inability|not return|did not return|error|404`
- **permission-continuity**: `permission|approv|authoriz|without (?:asking|confirm|consent)|unauthori|bypass|not allowed|forbidden|policy`

## Labeled steps a rule cited

- Hand-Crafted/20, cc-numeric-dropped: "WebSurfer's inability to reliably access the requested documents resulted in the overall task failure, as the necessary time span data could"
- Hand-Crafted/32, cc-numeric-dropped: "It provides incorrect instructions."
- Algorithm-Generated/126, dup-cross-thread: "The CorporateHistory_IPOs_MondayCom_Expert repeatedly writes incorrect code and provides inaccurate information in step 5, leading to a fals"

## False positive samples

- **cc-numeric-dropped**
  - Hand-Crafted/2: Upstream says "1 season". The delegation to WebSurfer is about the same thing but does not carry 1: "Please search for a list of series that Ted Danson has star
  - Hand-Crafted/8: Upstream says "$7.5". The delegation to WebSurfer is about the same thing but does not carry 7.5: "Please search for verified business articles, financial news 
  - Hand-Crafted/10: Upstream says "under $15". The delegation to WebSurfer is about the same thing but does not carry 15: "Conduct a search for the specific prices of ready-to-eat 
- **cc-identifier-dropped**
  - Hand-Crafted/2: Upstream names TV-14. The delegation to WebSurfer talks about it without naming it: "Please find a comprehensive list of TV series starring Ted Danson on IMDb a
  - Hand-Crafted/7: Upstream names https://www.youtube.com/watch?v=L1vXCYZAYYM. The delegation to WebSurfer talks about it without naming it: "Please open the YouTube video at the 
- **cc-negation-dropped**
  - Hand-Crafted/14: Upstream says "What percentage of the total penguin population according to the upper estimates on engli…". The delegation to WebSurfer is about the same thing 
- **term-orphan-thread**
  - Hand-Crafted/45: Assistant was delegated to and never reported back or was terminated.
- **dup-cross-thread**
  - Algorithm-Generated/87: Music_Critic_Expert and DataVerification_Expert both called code {"code":"Harbinger"}.
  - Algorithm-Generated/88: DataValidation_Expert and Verification_Expert both called python {"code":"import pandas as pd\n\n# Assuming the file 'apple_stock_data.csv' is in the curr….
  - Algorithm-Generated/104: Validation_Expert and PythonDebugging_Expert both called python {"code":"# filename: debug_template_specific.py\nimport sys\n\ndef main():\n try:\n print….

