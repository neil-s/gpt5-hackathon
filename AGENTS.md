# AGENTS.md

## Project Overview
Build a minimal GPT-5-powered assistant app for SMB IT admins that helps generate and run Microsoft 365 (`m365`) and Google Workspace (`gam`) CLI scripts. The app uses GPT-5’s CFG feature to strictly constrain generated commands to an allowlist of valid CLI verbs and flags, and uses GPT-5 preambles to provide transparent explanations before each tool call. The commands are executed locally on the user’s machine under their account, with safety features including typed user confirmation and dry-run mode.

---

## Goals
- Rapidly prototype and demo an interactive app that:
  - Takes natural language tasks from the user related to Office 365 and Google Workspace admin tasks.
  - Uses GPT-5 with CFG to output a **shell script** containing validated CLI commands.
  - Displays GPT-5-generated preambles explaining why commands are being executed.
  - Allows the user to save generated scripts as reusable files.
  - Executes the commands locally only after explicit typed confirmation (`I CONFIRM`).
  - Runs safely on Windows/macOS/Linux by detecting the OS and running commands in the appropriate shell (PowerShell or bash).

---

## Requirements

### GPT-5 Features
- Use CFG grammars to limit the model’s output to a predefined set of CLI commands and flags for `m365` and `gam`.
- Use GPT-5 preambles to generate user-visible explanations before each command/tool call.
- Output scripts as executable shell scripts (e.g., `.sh` or PowerShell scripts), **not JSON**, using the new custom tools feature to distinguish:
  - A **preamble tool call** that outputs the explanation before running commands.
  - A **script tool call** that outputs the full shell script ready for execution.

### Commands
- Commands limited to a safe allowlist of roughly 10 verbs each for `m365` and `gam` CLIs.
- Block dangerous commands or destructive flags unless explicitly enabled and confirmed.
- Commands should be executable locally via shell with safe quoting.

### Execution & Safety
- Dry-run mode default (no actual execution).
- Require typed confirmation ("I CONFIRM") before running commands.
- Run all commands locally on the user's machine, respecting their user context.
- Save generated scripts to disk on user request.
- Support cross-OS execution with correct shell (PowerShell on Windows, bash on Unix-like).

---

## Development Plan

### Single Unified TypeScript Project
- Use Node.js with Express or Fastify backend to:
  - Serve React frontend static files.
  - Provide API endpoints `/generate`, `/execute`, `/save`.
  - Integrate with OpenAI Node SDK.
  - Enforce CFG grammar and local allowlist validations.
  - Execute shell commands safely via `child_process.spawn`.
- Use React + Vite frontend to:
  - Let users input task descriptions and choose environment (`m365` or `gam`).
  - Display GPT-5 preambles and the generated shell script.
  - Provide UI controls to save scripts and execute commands with typed confirmation.

---

## API Endpoints

- `POST /generate`  
  Input: `{ env: "m365" | "gam", task: string, dry_run?: boolean }`  
  Output: `{ preamble: string, shell_script: string }`

- `POST /execute`  
  Input: `{ shell_script: string, confirm_token: "I CONFIRM" }`  
  Output: `{ stdout: string[], stderr: string[], status: number }`

- `POST /save`  
  Input: `{ filename: string, contents: string }`  
  Output: `{ path: string }`

---

## Safety & Validation

- CFG grammar enforces strict command syntax and allowed verbs/flags.
- Backend double-checks commands against an allowlist before execution.
- Execution requires explicit typed confirmation.
- No commands executed without user consent.
- Dry-run mode simulates execution for demos.
- No elevated privileges required by default.

---

## Deliverables

- CFG grammar files or templates for `m365` and `gam` CLI subsets.
- Express or Fastify backend implementing API endpoints with GPT-5 integration.
- React + Vite frontend UI showing input, preambles, generated shell script, and controls.
- Command execution engine supporting local OS shells and security checks.
- Demo scenarios showcasing creation of groups, users, enabling Teams, disabling MFA, etc.

---

## Next Steps

1. Generate CFG grammar and allowlist for `m365` and `gam`.
2. Scaffold minimal Express/Fastify + React project with API and UI.
3. Integrate GPT-5 calls with CFG and preambles using custom tools to output preamble and shell script.
4. Implement safe command execution and saving.
5. Prepare demo scripts and user flow for hackathon presentation.

---

## Environment

- Node.js 18+  
- TypeScript  
- React 18+ + Vite  
- Express or Fastify backend  
- OpenAI Node SDK (GPT-5 support)  
- Cross-platform support: Windows, macOS, Linux  
- Local shell execution (PowerShell/bash)  

---

## Local Run

- Dev (single process + HMR):
  - `npm install` (root), then `cd web && npm install`
  - `npm run dev` (root). Express mounts Vite middleware; open `http://localhost:3000`.
  - APIs available at `/generate`, `/execute`, `/save`.

- Prod (single server):
  - `npm run build:all` (builds web + backend)
  - `npm start` (serves `web/dist` and APIs on one port)

- One-shot start (build then serve):
  - `npm run start:prod`

---

## Documentation Rule

- Always update `PSEUDOCODE.md` whenever you change the code. It must reflect the current endpoints, execution flow, scripts, and any notable safety or validation behaviors.
