# Product Contracts

These documents capture product and engineering contracts that must not be broken when changing the workflow canvas, Agent chat, page wireframes, or modal layers.

Before touching related code, read the matching contract first, then update tests when behavior changes intentionally.

## Contracts

- [Workflow Agent Chat](workflow-agent-chat.md)
- [Requirement Dissection Function Map](requirement-dissection-function-map.md)
- [Interaction Lofi Canvas](interaction-lofi-canvas.md)
- [Requirement Slices](requirement-slices.md)
- [Layering And Modals](layering-and-modals.md)
- [Agent Inline Layout](agent-inline-layout.md)
- [Page Wireframe Output](page-wireframe-output.md)
- [Stage Artifact Rendering](stage-artifact-rendering.md)
- [Knowledge Framework Overview](knowledge-framework-overview.md)
- [Frontend Backend Handoff](frontend-backend-handoff.md)
- [UI Layout Standards](ui-layout-standards.md)
- [Cleanup Protection Boundary](cleanup-protection-boundary.md)

## Change Rule

Do not rely on memory or screenshots alone. If a behavior is important enough to preserve, it must have:

1. A contract entry in this folder.
2. A code comment near the fragile logic when helpful.
3. A regression test that fails when the contract is broken.
