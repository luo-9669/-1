# Web Factory Capture Recovery Flows Design

## Goal

Build a clear, production-style recovery model for Web Factory so users can continue from URL capture failures through four paths: remote browser login, Cookie/session input, uploaded web snapshot package, and image-to-code.

## Recommended Architecture

Use a backend-owned capture orchestration model. The frontend owns user interaction, input state, path switching, uploads, and progress feedback. The backend owns browser sessions, Cookie injection, SingleFile capture, CDP DOMSnapshot capture, screenshot capture, snapshot-package parsing, quality gates, HTML generation, Vue conversion, and restored asset persistence.

This is the recommended large-company style because login state, Cookies, browser automation, and capture quality checks are security-sensitive and operationally unstable. Keeping them backend-owned makes the pipeline testable, replaceable, auditable, and consistent across projects.

## Frontend Responsibilities

- Present the four recovery flows as clickable cards in Web Factory.
- Route users to the right tab and input mode.
- Collect URL, Cookie/session text, snapshot package uploads, screenshots, and optional prompts.
- Show progress, loading states, failure reasons, and next-step recommendations.
- Read persisted restored pages from backend APIs for both post-generation detail and asset detail.

## Backend Responsibilities

- 后端接管采集编排.
- Create isolated remote browser sessions by project and target URL.
- Store and reuse authenticated session state for capture.
- Validate Cookie/session payloads against target domains before injection.
- Run SingleFile CLI, CDP DOMSnapshot, screenshot capture, and fallback HTML fetch.
- Parse uploaded web snapshot packages into the same `captureResult` contract.
- Run capture readiness and quality gates before generating formal restored assets.
- Generate static HTML first, then optionally convert to Vue code.
- Persist `restoredPage`, source files, cover images, visual verification, and capture diagnostics.

## Recovery Flows

### Remote Browser Login

Recommended default for protected pages. The user enters a URL, opens an embedded remote browser, logs in there, then starts capture. Frontend sends `projectId`, `url`, and `sessionId`. Backend returns `captureResult`, `qualityGate`, and persisted `restoredPage`.

### Cookie / Session

Advanced path for users who can provide Cookie or storage-state data. Frontend sends `projectId`, `url`, and `cookieText`. Backend validates the domain, injects session state into the browser context, captures the page, and returns recoverable errors such as `COOKIE_EXPIRED` or `DOMAIN_MISMATCH`.

### Web Snapshot Package

Stable offline fallback for pages that cannot be reached by the platform. Frontend uploads a zip package. Backend extracts HTML, CSS, screenshots, assets, and manifest data, then converts them into the same `captureResult` shape used by URL capture.

### Image To Code

Risk-control fallback for screenshot-only workflows. Frontend uploads the image and prompt. Backend performs visual recognition, layout extraction, static HTML generation, and optional Vue conversion. This path optimizes visual resemblance, not real DOM preservation.

## Unified Data Contract

Frontend request shape:

```json
{
  "projectId": "project-flow",
  "sourceType": "remote-browser | cookie-session | snapshot-package | image-to-code",
  "url": "https://example.com",
  "sessionId": "optional-browser-session",
  "cookieText": "optional-cookie-text",
  "file": "optional-upload",
  "prompt": "optional-image-or-style-prompt",
  "outputMode": "html | vue"
}
```

Backend response shape:

```json
{
  "captureResult": {},
  "qualityGate": {},
  "restoredPage": {
    "id": "page-id",
    "projectId": "project-flow",
    "html": "<!doctype html>...",
    "files": [{ "path": "index.html", "content": "<!doctype html>..." }],
    "coverImage": "data:image/png;base64,...",
    "visualVerification": {}
  },
  "diagnostics": []
}
```

## UI Design

The Web Factory home keeps three tabs: image-to-code, URL capture, and style transfer. The URL tab can later be renamed to `采集网页`, but the current implementation may keep its existing key to avoid route churn.

Both image-to-code and URL capture sections expose the same recovery-flow cards. Each card includes scenario, frontend ownership, backend ownership, handoff data, and a direct action. Clicking a card sets the right tab and form mode.

## Error Handling

Frontend displays backend errors without pretending generation succeeded. Backend blocks generation when capture quality is too low, access is denied, the page is a login/error page, or required DOM/layout data is missing. The response must include recovery actions so the frontend can point users to the next path.

## Testing

Tests should verify that the Web Factory source documents all four flows, includes frontend/backend ownership copy, includes `后端接管采集编排`, renders `capture-recovery-card`, and exposes `goRecoveryFlow`.

