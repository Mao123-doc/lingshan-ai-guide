# Competition feature alignment implementation plan

Spec: docs/competition/submission-alignment-proposal-20261015.md, approved for implementation by the user's 2026-10-15 instruction.

Goal: restore the submitted prototype's visitor interactions, operational feedback and route safety on the existing implementation, then verify and publish source to the user's GitHub fork.

Architecture: React device/UI adapters call Express APIs; deterministic route and RAG logic remain authoritative. Operational state is persisted under DATA_ROOT. Browser speech avoids restoring a missing 8001 service. External vision requires explicit provider configuration.

## Tasks
- [x] Backend operations: tests first for persistent feedback, dashboard, digital-human settings, sentiment and geographic endpoints; authenticated admin APIs, scoped WebSocket updates; implement without synthetic analytics.
- [x] Visitor UI: tested speech adapters, Live2D lifecycle, camera upload, GPS nearby list, feedback, truthful provider errors, cancellation and evidence retention.
- [x] Route safety: audit current constraints; implement opt-in/default-safe exit return, check-in buffer, progress-based replanning and distance evidence with regression tests; do not fabricate topology or slope.
- [x] Integration: restore protected admin routes, unified errors, CORS config, streaming metadata and release feature contract; ensure clean package includes all active resources.
- [x] Verification: backend tests and algorithm regressions, frontend unit tests/lint/build, Python tools, browser checks using isolated data. Record external-device/model and hardware verification limits explicitly.
- [x] Publish: inspect staged diff and secrets, commit only relevant source/docs and necessary existing changes, push codex/competition-feature-alignment to myfork. No forced push and no upstream merge.

## Rulings
- Work in current directory to preserve existing uncommitted fixes; use a new branch rather than a fresh checkout that omits them.
- Original 17-page PPT and PDF remain immutable functional references; functional restoration does not certify historical performance, survey, mapping or physical-measurement claims.
- Backend/UI/route responsibilities are disjoint and delegated under subagent-driven-development; integration and final review stay with root agent.
- The user's explicit instruction to begin and publish authorizes implementation and push to their fork; do not add another plan approval round.

## Execution ledger
- All source tests and production/browser checks passed; see docs/testing/competition-alignment-20261015.md.
- Three P2 final-review findings fixed and re-reviewed: cache corruption detection, socket reconnect, recoverable dashboard loading.
- Ruling: preserve sample Hibiki dynamic model and explicitly document lack of custom Hanfu Live2D asset rather than present static Hanfu portraits as a custom dynamic model.
- Ruling: myfork old URL does not exist; authenticated GitHub account owns lingshan-ai-guide-ablation, fetched master is an ancestor of local HEAD. Correct myfork to this verified existing repository and publish a new branch without modifying master.
- Release preparation: source staged after privacy scan; final commit and push identifiers are reported in the chat and package manifest, avoiding a self-referential commit hash in this file.
