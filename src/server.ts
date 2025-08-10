import "dotenv/config";
import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { z } from "zod";
import OpenAI from "openai";
import { generateScript } from "./openaiClient.js";

// OpenAI client (GPT-5 with tool grammar support)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Types
const GenerateSchema = z.object({
  env: z.union([z.literal("m365"), z.literal("gam")]),
  task: z.string().min(1),
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
  const { env, task } = parsed.data;

  // Prefer cached response when requested, even without API key
  const useCache = req.query.cache === "1" || req.query.cache === "true";
  if (!process.env.OPENAI_API_KEY && !useCache) {
    // Fallback to stub only when no API key and cache not requested
    const shell_script = os.platform() === "win32"
      ? `Write-Host "${task}` + `"`
      : `#!/usr/bin/env bash\necho "${task}"`;
    return res.json({ shell_script });
  }

  try {
    const result = await generateScript(env, task, { useCache });
    return res.json({ shell_script: result.script, model_text: result.text, raw: result.raw, input_messages: result.inputMessages });
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
