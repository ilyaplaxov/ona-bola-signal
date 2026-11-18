# Questions for the mentor sessions

18 Nov 2026, 10:00–13:00. Record answers below, then move decisions into `DECISIONS.md` and rules into `RULES_PROVENANCE.md`.

## Domain mentor

1. What does OvaBMU stand for, and which role should receive Red and Yellow alerts?
2. We use the national protocols of order No. 180 of 23 June 2025 («Антенатальный уход. Ведение беременных групп риска», «Ведение беременных с железодефицитной анемией») for every cut-off; see `RULES_PROVENANCE.md`. Can a clinician confirm the zone each rule gives, which fasting-glucose value applies (p. 20 says 5.6 mmol/L at screening, p. 31 says 5.1–6.9), and whether the pre-eclampsia rule should require 20+ weeks?
3. Which indicators and units do district lab forms use? We currently assume blood pressure in mmHg, haemoglobin in g/L, proteinuria in g/L and glucose in mmol/L.
4. Who acknowledges an alert, and within what time?
5. What do district teams use today to track high-risk pregnancies?
6. Which personal-data rules apply to a pilot, including any requirement to keep citizens' data on servers in Uzbekistan? This decides hosting, and whether real data could ever reach a cloud AI service.
7. Which newborn indicators would matter first, for the roadmap?
8. Rule set `demo-0.2` (`RULES_PROVENANCE.md`): is the third-trimester anaemia threshold 110 g/L (antenatal protocol p. 28, anaemia protocol p. 13) or 105 g/L (antenatal protocol p. 20)? Does the third trimester start at 28 weeks (the protocol does not say)? Are 7 days of grace right for the stale-data warnings (105 days before 28 weeks, 35 days after)? Which risk groups (pp. 33–41) should the patient card show, and should registration ask for the history (births, BMI, risk factors)?

## Technical mentor

1. Is the split between a deterministic engine and a bounded LLM convincing? What would you test first?
2. What would you change in the data model or the audit trail before a pilot?

## Business mentor

1. Who would buy and run this: district administrations, regional health departments or the ministry?
2. Which pricing model fits public healthcare: per district, per facility, or a state contract?
3. Which existing systems would it have to connect to first?

## Answers

_Fill in during the sessions._
