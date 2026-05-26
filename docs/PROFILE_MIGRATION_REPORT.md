# Profile Migration Report — Questions to Coverage Topics

**Generated:** 2026-05-25
**Script:** `scripts/migrate-profile-questions-to-coverage.ts`
**Status:** ✅ Complete — all 71 documents migrated

---

## 1. Final Summary

| Metric | Before | After |
|---|---|---|
| Document YAMLs with questions | 71 | 71 (all migrated) |
| Total questions | 6,633 | — |
| Source questions preserved | — | 6,633 (100%) |
| Coverage topics generated | — | 1,213 |
| Average topics per document | — | ~17 |
| Avg questions per topic | — | ~5.5 |
| Files needing manual review | — | 1 (acceptable) |

## 2. Files Migrated

All 71 document YAMLs in `profiles/standard/phases/` have been converted to the new `interview:` model with `canonicalQuestion`, `coverageTopics`, `sufficiency`, and `followUpPolicy`.

### By Phase

| Phase | Documents | Questions | Topics | Avg Topics |
|---|---|---|---|---|
| 01-foundation | 7 | ~130 | 37 | 5.3 |
| 02-validation | 10 | ~450 | 130 | 13 |
| 03-product | 13 | ~950 | 205 | 15.8 |
| 04-engineering | 14 | ~1,800 | 290 | 20.7 |
| 05-go-to-market | 13 | ~1,600 | 285 | 21.9 |
| 06-operations | 14 | ~1,700 | 266 | 19.0 |
| **Total** | **71** | **~6,633** | **1,213** | **~17** |

## 3. Single File Requiring Manual Review — REVIEWED ✅

| File | Topics | Reason | Verdict |
|---|---|---|---|
| `06-operations/14-operational-risks.yml` | 31 | Risk register consolidating 14 upstream documents. 31 distinct risk categories (support, reliability, financial, compliance, vendor, team, process, etc.) + risk management processes (ownership, escalation, mitigation, review). Each is a genuinely separate concern. | **Reviewed: no consolidation needed.** Granularity is architecturally correct for a comprehensive risk register. Marked `reviewRequired: false`. |

## 4. Preservation Guarantee — Verified

- ✅ **100% of questions preserved** — every `sections[].questions[]` entry appears in `interview.coverageTopics[].sourceQuestions[]`
- ✅ **Original sections preserved** — `sections[]` with `questions` remain intact
- ✅ **Schema validation passes** — all 71 documents pass `DocumentDescriptorSchema.safeParse()`
- ✅ **No data loss** — migration is additive (adds `interview:` block, never removes)

## 5. Schema Changes

| File | Change |
|---|---|
| `profiles/standard/document.schema.yml` | Added `interview` and `reviewChecklist` optional fields; deprecated `sections[].questions` |
| `src/core/schema/document.schema.ts` | 10 Zod schemas implemented |

## 6. Prompt Contract Updates

| File | Update |
|---|---|
| `src/prompts/assess-answer.prompt.ts` | References `CoverageAssessment` structured output |
| `src/prompts/synthesize-canonical-answer.prompt.ts` | References coverage model |
| `src/prompts/generate-document.prompt.ts` | References `generationMapping` |

## 7. How to Use the New Model

```txt
1. Load document YAML
     → document.interview.canonicalQuestion ("Explain founding thesis...")

2. Ask user the canonicalQuestion
     → User answers freely (narrative, bullets, mixed)

3. Persist answer verbatim in transcript.jsonl

4. Evaluate coverage
     → assessAnswer() receives canonicalQuestion + coverageTopics
     → LLM returns CoverageAssessment via generateStructuredOutput()
     → coveredTopicIds, missingRequiredTopicIds, weakTopicIds

5. If insufficient:
     → Generate follow-up only about missingRequiredTopicIds
     → Respect followUpPolicy.maxMissingTopicsPerFollowUp (3)

6. If sufficient:
     → synthesizeCanonicalAnswer() → CanonicalAnswerDraft
     → User confirms → CanonicalAnswerRecord persisted

7. Generate document:
     → generationMapping maps topics to document sections
     → Document generated with traceability (sourceCanonicalAnswerIds)
```
