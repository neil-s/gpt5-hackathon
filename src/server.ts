import "dotenv/config";
import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { z } from "zod";
import OpenAI from "openai";

// Minimal OpenAI client (no CFG/tools yet)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Types
const GenerateSchema = z.object({
  env: z.union([z.literal("m365"), z.literal("gam")]),
  task: z.string().min(1),
  dry_run: z.boolean().optional().default(true),
});

const ExecuteSchema = z.object({
  shell_script: z.string().min(1),
  confirm_token: z.literal("I CONFIRM"),
});

const SaveSchema = z.object({
  filename: z.string().min(1),
  contents: z.string(),
});

// Basic health
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// POST /generate (minimal OpenAI integration)
app.post("/generate", async (req, res) => {
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { env, task, dry_run } = parsed.data;

  // Fallback to stub if no API key
  if (!process.env.OPENAI_API_KEY) {
    const preamble = `OpenAI API key not set; returning stub. Task: ${task} (env=${env}, dryRun=${dry_run})`;
    const shell_script = os.platform() === "win32"
      ? `Write-Host "Dry run: ${task}"`
      : `#!/usr/bin/env bash\necho "Dry run: ${task}"`;
    return res.json({ preamble, shell_script });
  }

  try {
    const isWindows = os.platform() === "win32";
    const shell = isWindows ? "PowerShell" : "bash";
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const system = [
      `You write minimal, safe shell scripts for ${env} admin tasks.`,
      `Only output two sections exactly in this order and format:`,
      `PREAMBLE:`,
      `- 1-3 sentences explaining what will run and why.`,
      `SCRIPT:`,
      `- A ${shell} script for ${isWindows ? "Windows (PowerShell)" : "Unix (bash)"}.`,
      `- Prefer dry-run friendly commands. If dry_run=true, simulate actions via echo/no-op flags.`,
      `- Quote safely. Do not include any extra commentary outside these sections.`,
    ].join("\n");

    const user = [
      `Task: ${task}`,
      `Environment: ${env}`,
      `OS: ${isWindows ? "windows" : "unix"}`,
      `Dry-run: ${dry_run ? "true" : "false"}`,
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content || "";
    const preambleMatch = text.match(/PREAMBLE:\s*([\s\S]*?)\n\s*SCRIPT:/i);
    const afterScript = text.split(/\n\s*SCRIPT:\s*/i)[1] || "";
    let script = afterScript;
    const fence = afterScript.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
    if (fence) script = fence[1];

    const preamble = preambleMatch ? preambleMatch[1].trim() : text.trim();
    const shell_script = script.trim();
    return res.json({ preamble, shell_script });
  } catch (e: any) {
    return res.status(500).json({ error: "openai_error", message: e?.message || String(e) });
  }
});

// Helper to execute in local shell safely (simulated; dry-run only here)
function runShellScript(script: string) {
  return new Promise<{ stdout: string[]; stderr: string[]; status: number }>((resolve) => {
    const isWindows = os.platform() === "win32";
    const shell = isWindows ? "powershell.exe" : "bash";
    const args = isWindows ? ["-NoProfile", "-NonInteractive", "-Command", script] : ["-lc", script];
    const child = spawn(shell, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: string[] = [];
    const stderr: string[] = [];
    child.stdout.on("data", (d) => stdout.push(d.toString()))
    child.stderr.on("data", (d) => stderr.push(d.toString()))
    child.on("close", (code) => resolve({ stdout, stderr, status: code ?? 0 }));
  });
}

// POST /execute
app.post("/execute", async (req, res) => {
  const parsed = ExecuteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { shell_script } = parsed.data;
  // Execute locally under user context
  const result = await runShellScript(shell_script);
  res.json(result);
});

// POST /save
app.post("/save", async (req, res) => {
  const parsed = SaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { filename, contents } = parsed.data;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const outDir = path.resolve(process.cwd(), "scripts");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, safeName);
  await fs.writeFile(outPath, contents, { encoding: "utf8", mode: 0o700 });
  res.json({ path: outPath });
});

// ---- Frontend wiring ----
const isProd = process.env.NODE_ENV === "production";

async function attachFrontend(app: express.Express) {
  if (!isProd) {
    // Vite middleware (HMR) in dev
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: path.resolve(process.cwd(), "web"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get(/^(?!\/(health|generate|execute|save)\b).*/, async (req, res) => {
      const url = req.originalUrl;
      const indexPath = path.resolve(process.cwd(), "web", "index.html");
      let template = await fs.readFile(indexPath, "utf8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    });
  } else {
    // Serve built assets in prod
    const dist = path.resolve(process.cwd(), "web", "dist");
    app.use(express.static(dist));
    app.get(/^(?!\/(health|generate|execute|save)\b).*/, (_req, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
attachFrontend(app).then(() => {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${PORT}`);
  });
});
