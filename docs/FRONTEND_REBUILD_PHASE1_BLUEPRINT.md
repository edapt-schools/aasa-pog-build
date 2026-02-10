# AASA Frontend Rebuild vNext - Phase 1 Blueprint

## Purpose

Define the product and architecture blueprint for an ambitious AI-first frontend rebuild before implementation starts. This phase does not ship production features; it locks decisions, workflows, and phase gates.

## Product North Star

Create a chat-first district intelligence workspace where users can:

- Ask for leads and grant matches using natural language.
- Upload files (grant docs, event attendee files) as search context.
- Use voice input (mic) for command-style queries.
- See transparent evidence for every recommendation ("why this district").
- Take immediate actions: open district site, copy contact, create hit lists, build grant cohorts, export evidence.

## Stakeholder Outcomes

- Jeff (Sales): "Next hottest uncontacted leads now" with 3-10-20 execution.
- Todd (Grants): threshold-aware grant matching (FRPL, minority, evidence) with defensible citations.
- Tammy (Leadership): proactive strategic intelligence with state/regional drilldowns and actionable handoffs.

## Locked Design Decisions

### 1) AI Command Center Is Primary

- A ChatGPT-style composer is the default interface for cross-mode work.
- Inputs: text, file upload, microphone.
- Outputs: ranked results plus action commands.

### 2) Explainability Is Required

- Every surfaced district gets a "Why this district" rationale.
- Include matched signals, source excerpts, score factors, and confidence.
- Display policy:
  - Compact explanation for every result.
  - Full rationale precomputed for top 25 results.
  - On-demand generation for lower-ranked results.

### 3) Confidence Governance

- Confidence bands: High (>= 0.80), Medium (0.60-0.79), Low (< 0.60).
- Full recommendation treatment starts at >= 0.60.
- Low confidence results are still visible but explicitly labeled with caution.

### 4) Scoring Model Strategy

- Existing district scoring (`district_keyword_scores`) is the foundation.
- Continue to use taxonomy-weighted signals with recency/specificity adjustments.
- Add engagement-aware ranking on top (contact history, stage freshness, ownership).

### 5) "Next Hottest Uncontacted" as First-Class Command

- Command examples:
  - "Who are the next hottest uncontacted leads this week?"
  - "Show top 20 uncontacted Tier 1 districts in CA and TX."
- Requires contact-state exclusions and engagement recency logic.

### 6) Grant Criteria Extraction

- Parse uploaded RFP docs into structured constraints:
  - FRPL threshold
  - Minority threshold
  - State/location constraints
  - required initiative/evidence terms
- Surface criteria as editable chips with strict/soft matching modes.

## Current-State Readout (from codebase audit)

- Available now:
  - `district_keyword_scores` table and computed scoring pipeline.
  - Semantic document search and evidence retrieval primitives.
- Missing for vNext command quality:
  - Engagement timeline model (contacted, stage, owner, last touch, outcomes).
  - End-to-end score/tier filtering parity in district list APIs.
  - Unified orchestration layer blending semantic + syntax + score + engagement.

## Phase 1 Deliverables

### D1. Product Spec Pack

- Final interaction model for chat-first UX.
- Command taxonomy and grammar (lead, grant, insights, actions).
- Explainability contract and confidence policy.
- Cross-mode action mapping.

### D2. Data and Ranking Spec

- Canonical ranking formula definition:
  - `CompositeRank = SignalScore + SemanticFit + EligibilityFit + EngagementPriority - Exclusions`
- "Uncontacted" definition and exclusion rules.
- Threshold semantics for grant filtering (hard vs soft constraints).

### D3. Architecture Spec

- Orchestration design for intent classification and tool routing.
- API contract matrix for all visible controls and command outputs.
- Caching and lazy-generation policy for explainability.

### D4. Delivery Plan

- Full multi-phase rebuild plan with phase gates and acceptance criteria.
- Risk register and fallback policy.
- Milestone mapping for Linear.

## Proposed Full Rebuild Phases (Planning Baseline)

1. Phase 1 - Blueprint and contract lock (this document).
2. Phase 2 - AI command center and orchestration core.
3. Phase 3 - Explainability and confidence engine.
4. Phase 4 - Lead intelligence workspace and hit-list actions.
5. Phase 5 - Grant pursuit workspace with criteria extraction and cohorts.
6. Phase 6 - Engagement memory, conversation tracking, and forecasting.
7. Phase 7 - Leadership intelligence and proactive briefing.
8. Phase 8 - Hardening, UAT, and launch readiness.

## Acceptance Criteria for Phase 1

- Team agrees to chat-first as default IA.
- "Why this district" and confidence policy approved.
- "Next hottest uncontacted" command behavior approved.
- Grant criteria extraction behavior approved.
- Rebuild phases and gates accepted by stakeholders.
- Linear project updated to reflect vNext planning structure.

## Non-Goals in Phase 1

- No production implementation.
- No schema migrations applied.
- No frontend rollout.

## Immediate Next Planning Actions

1. Confirm confidence threshold policy (default 0.60) and top-25 explainability precompute.
2. Finalize engagement data model requirements for "uncontacted" logic.
3. Approve command grammar v1 and grant criteria parser behavior.
4. Convert this blueprint into milestone/issue structure in Linear.

