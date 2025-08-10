# PSEUDOCODE.md

This document explains what the current code does in plain English and lightweight pseudocode.

## Overview
- Single Node.js process provides both API and UI.
- In development, Express uses Vite middleware (HMR). In production, Express serves the built React app from `web/dist`.
- Backend exposes three API endpoints: `/generate`, `/execute`, `/save`, and a health check `/health`.
- Frontend offers a minimal UI to choose environment (`m365` or `gam`), enter a task, and display the generated preamble + shell script.

## Backend (src/server.ts)

Initialize server
- import express, cors, zod, fs/path/os utilities, child_process.spawn
- app.use(cors())
- app.use(express.json())

Define schemas (zod)
- GenerateSchema: { env: 'm365' | 'gam', task: string, dry_run?: boolean }
- ExecuteSchema: { shell_script: string, confirm_token: 'I CONFIRM' }
- SaveSchema: { filename: string, contents: string }

Health endpoint
- GET /health -> { ok: true }

Generate endpoint
- POST /generate
  - validate body with GenerateSchema
  - if invalid -> 400
  - If `OPENAI_API_KEY` is missing:
    - Return stub preamble and simple dry-run script (Write-Host/echo)
  - Else call OpenAI Responses API:
    - system text: instructs to output two sections (PREAMBLE, SCRIPT) only
    - user text: includes task, env (m365/gam), OS (windows/unix), and dry-run flag
    - if env=gam, load `cfg/gam.gbnf` and append as a hard constraint note in the system guidance (interim until native CFG hook)
    - parse response text:
      - extract PREAMBLE text between `PREAMBLE:` and `SCRIPT:`
      - extract SCRIPT code block (inside triple backticks if present)
    - return { preamble, shell_script }

Execute helper
- function runShellScript(script)
  - detect platform
    - Windows -> spawn `powershell.exe -NoProfile -NonInteractive -Command <script>`
    - Unix -> spawn `bash -lc <script>`
  - collect stdout/stderr arrays and exit code
  - resolve { stdout, stderr, status }

Execute endpoint
- POST /execute
  - validate body with ExecuteSchema (confirm_token must be exactly "I CONFIRM")
  - run runShellScript(body.shell_script)
  - return { stdout, stderr, status }

Save endpoint
- POST /save
  - validate body with SaveSchema
  - sanitize filename -> replace non [a-zA-Z0-9._-] with underscore
  - ensure `scripts/` directory exists
  - write file with mode 0700
  - return { path }

Frontend wiring
- If NODE_ENV !== 'production'
  - create Vite dev server with root=web, middlewareMode=true
  - app.use(vite.middlewares)
  - catch-all route (excluding API paths) -> read web/index.html, transform via vite.transformIndexHtml, and respond
- Else (production)
  - app.use(express.static('web/dist'))
  - catch-all route (excluding API paths) -> serve web/dist/index.html

Server start
- PORT = env.PORT || 3000
- attachFrontend(app).then(() => app.listen(PORT))

Notes / TODOs
- GPT-5 integration is not implemented yet.
- CFG grammar + allowlist validation not implemented yet.
- `/generate` is stubbed; later it should call GPT-5 using CFG and return a validated shell script.
- Dry-run behavior is currently represented by the stub script; fine-grained dry-run execution vs. real execution still to be added.

## Frontend (web/)

App state
- env: 'm365' | 'gam' (default 'gam')
- task: string
- script: string
- modelText: string (model textual output if any)
- reasoning: string (extracted from OpenAI Responses API reasoning blocks)
- raw: any (raw JSON from API)
- inputMessages: Array of request messages sent to OpenAI

Generate flow
- On click "Generate":
  - POST /generate with { env, task }
  - receive { shell_script, model_text, raw, input_messages }
  - extract `reasoning` from `raw.output` blocks where `type === "reasoning"` (concatenate `summary[].text`, optional `text`, and step texts)
  - update UI state

Render
- Simple form with environment select, task input, and Generate button
- Sections when data present:
  - Script (syntax-highlighted)
  - Reasoning (only if extracted; shown between Script and Debug)
  - Debug (Input sent to OpenAI, Model Text, Raw JSON)

Build/Serve
- Dev: Express mounts Vite HMR. Navigate to http://localhost:3000
- Prod: `web/dist` is served by Express

## NPM Scripts (root)
- dev: Start Express with ts-node + Vite middleware (HMR)
- build:web: Build React app in `web/`
- build: Compile backend TypeScript to `dist/`
- build:all: Build web then backend
- start: Start compiled backend from `dist/`
- start:prod: Build everything then start server
