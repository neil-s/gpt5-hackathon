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
  - construct a placeholder preamble and a simple shell script:
    - on Windows: PowerShell `Write-Host "Dry run: ..."`
    - on Unix: bash script `echo "Dry run: ..."`
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
- env: 'm365' | 'gam' (default 'm365')
- task: string
- preamble: string
- script: string

Generate flow
- On click "Generate":
  - POST /generate with { env, task, dry_run: true }
  - receive { preamble, shell_script }
  - set UI state to display results

Render
- Simple form with environment select, task input, and Generate button
- Two sections displaying Preamble and Generated Script if present

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

