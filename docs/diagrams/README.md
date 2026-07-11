# Draw.io Diagram Output Guide

This folder stores Draw.io / diagrams.net sources and exported diagram assets for project deliverables.

Draw.io is a documentation companion here. It does not replace the workflow canvas, backend-generated artifacts, ASCII wireframes, or existing `/api/diagrams/generate` behavior.

## Tool

- Authoring: <https://app.diagrams.net/>
- Save target: Device / local file
- Editable source: `.drawio`
- Review/export asset: `.svg`, `.png`, or `.pdf`

## Folder Layout

```text
docs/diagrams/
  README.md
  templates/
    frontend-backend-handoff.drawio
  assets/
    exported images for Markdown, PRD, or review decks
```

## When To Use Draw.io

Use Draw.io when a text diagram becomes hard to scan:

- User or business flow has more than 8 steps.
- Decision branches go deeper than 3 levels.
- State machine has more than 5 states or complex fallback paths.
- Frontend/backend/API ownership needs a visual handoff.
- A diagram is going into a stakeholder review or external delivery.

Keep short or temporary diagrams in Markdown text blocks.

## Output Rules

- Keep the `.drawio` source file in `docs/diagrams/templates/` or a topic folder under `docs/diagrams/`.
- Export reviewable assets to `docs/diagrams/assets/`.
- Name files by artifact and purpose, for example:
  - `frontend-backend-handoff.drawio`
  - `frontend-backend-handoff.svg`
  - `requirement-dissection-flow.drawio`
- In Markdown, reference exported assets like this:

```md
![Frontend/backend handoff](../diagrams/assets/frontend-backend-handoff.svg)
```

## Contract Boundaries

- Backend owns structured workflow data, generated artifacts, page layout artifacts, and business output.
- Frontend owns rendering and interaction.
- Draw.io files are manually maintained documentation artifacts unless a future contract explicitly adds runtime integration.
- Do not write "Draw.io file generated" unless a real `.drawio` or exported asset exists in this folder.
- Do not replace workflow canvas rendering with Mermaid, Draw.io embed, ReactFlow, X6, Excalidraw, or another diagram workbench without a product contract update.

## Basic Workflow

1. Open <https://app.diagrams.net/>.
2. Choose `Device`.
3. Open a `.drawio` source from this folder or create a new one.
4. Edit the diagram.
5. Save the `.drawio` source back into this folder.
6. Export SVG or PNG into `docs/diagrams/assets/` for Markdown and review use.

The starter template is `docs/diagrams/templates/frontend-backend-handoff.drawio`.
