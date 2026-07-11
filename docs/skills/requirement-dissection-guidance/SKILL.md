---
name: requirement-dissection-guidance
description: Use when generating or reviewing the requirement-dissection stage for 流程通 total design flow, especially when page coverage, evidence boundaries, stage handoff, or duplicate artifact/display risks are involved.
---

# Requirement Dissection Guidance

## Overview

The requirement-dissection stage converts a user's product demand into design-ready structure. It should separate facts, assumptions, open questions, page coverage, decisions, exceptions, data/state flow, and downstream handoff hints before page-level low-fidelity work begins.

## When to Use

- The current workflow stage is `requirement-dissection`.
- A previous analysis needs to be regenerated or repaired before `requirement-slicing`, `gap-confirmation`, or `interaction-lofi`.
- The output must preserve project/non-project evidence boundaries.
- The implementation must avoid duplicate artifact fields or duplicate frontend disclosures.

## Core Method

1. Identify demand scope: project demand or non-project demand.
2. Build evidence and assumptions from user input, uploaded attachments, dialogue confirmations, model assumptions, and project knowledge only when the run is project-scoped.
3. Produce canonical structured artifacts: product definition, user scenarios, navigation, module matrix, page hierarchy, page coverage, decision points, exceptions, data flow, state machine, jump graph, sharing mechanism, open questions, and downstream hints.
4. Build `productAnalysisPipeline` from the active workflow contract. Ordinary total-flow analysis uses the nine visible chapters: requirement understanding, gap confirmation, user journey analysis, feature/page decomposition, business rules/state flow, flow architecture, design opportunity, priority roadmap, and acceptance standards. Advanced UX analysis uses the seven Markdown-imported chapters: requirement understanding, requirement decomposition, risk assumption, flow and information architecture, opportunity and solution, priority and phasing, and delivery and acceptance.
5. Use `detailBlocks[].sourceRef` to point to canonical fields. Do not copy full matrices into pipeline blocks when a root artifact field already owns the data.
6. Produce `pageFrameContracts` so every downstream page can inherit navigation binding, layout regions, content hierarchy, interaction hotspots, state variants, data dependencies, and transition edges.
7. Keep page coverage complete enough for every downstream page to inherit source, entry, exit, primary action, states, and data dependencies.
8. Keep top navigation, page hierarchy, data flow, state machines, and jump graphs structurally usable: navigation items need target page ids and visibility/active rules; hierarchy page nodes need page ids, parent ids, levels, and page types; graph/state/jump edges need ids, page bindings, conditions, and preservation hints.
9. Keep interaction-lofi page artifacts page-local. Global structures may be inherited as related rows, but must not replace page wireframes.

## Hard Boundaries

- Do not send or display project knowledge for non-project runs.
- Do not treat skill, contract, or spec documents as business evidence.
- Do not write `pageCoverageMatrix` under `designRequirementMap`; root `requirementDissectionArtifact.pageCoverageMatrix` is canonical.
- Do not write `projectFunctionMap` into `requirementDissectionArtifact`; it belongs on `totalFlow` and the requirement-dissection agent node.
- Do not add parallel artifact families such as `crossPageFunctionGraph`, `interactionSpecSchema`, or `interactionSpecRequirementArtifact`.
- Do not create separate requirement-dissection canvas cards for every matrix when `productAnalysisPipeline` can reference the canonical sources.
- Do not duplicate top navigation, page hierarchy, user journey, data flow, state machine, or cross-function relations in frontend-only fields.
- Do not create a second Agent implementation for analysis stages.
- Do not show the same guidance twice in the frontend; display guidance only in the requirement-dissection detail view.

## Quality Checklist

- Each page can be traced back to a demand source and has a clear entry, exit, main action, state coverage, and data dependency.
- Decision points can explain branch pages or downstream interactions.
- Exception rows include failure, empty, permission, timeout, retry, and recovery paths when applicable.
- Open questions name their impact instead of blocking all downstream work.
- Downstream hints are specific enough for interaction-lofi, UI, HTML/Vue, and acceptance stages to reuse.
- The `flow-information-architecture` tab includes sourceRef blocks for `navigationStructure`, `pageHierarchyTree`, `userJourneyMap`, `dataFlowGraph`, `stateMachineMap`, and `featureJumpGraph`.
- `pageFrameContracts` covers every page and references canonical source ids instead of copying the matrices.
- Navigation, hierarchy, data-flow, state-machine, and jump-graph fields expose machine-readable page bindings in addition to human-readable labels.
