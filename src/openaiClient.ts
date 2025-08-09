import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type SupportedEnv = "m365" | "gam";

const DEV_CACHED_RESPONSE: any = {
  id: "resp_6897d36a5b5081949e9dbfdb901218c70d2ee6fbed09c91d",
  object: "response",
  created_at: 1754780527,
  status: "completed",
  output: [
    { id: "rs_6897d3707e9081948c9ee78c6e8c63930d2ee6fbed09c91d", type: "reasoning", summary: [] },
    {
      id: "ctc_6897d37632888194be6e54aec75919da0d2ee6fbed09c91d",
      type: "custom_tool_call",
      status: "completed",
      call_id: "call_MX2segI0Ft5F3H6B78ncF4Ko",
      input: "gam create user neil@joinrollout.ai firstname \"Neil\" lastname \"Satra\" password \"Temp#Satra2025!\" changepassword on",
      name: "execute_gam",
    },
  ],
  output_text: "",
};

export async function generateScript(env: SupportedEnv, task: string, opts?: { useCache?: boolean }): Promise<{ script: string; text: string; raw: any }> {
  const isWindows = os.platform() === "win32";
  const shell = isWindows ? "PowerShell" : "bash";
  const model = process.env.OPENAI_MODEL || "gpt-5";

  // Load Lark grammar for the selected environment
  const grammarPath = path.resolve(process.cwd(), "cfg", `${env}.lark`);
  const grammarText = await fs.readFile(grammarPath, "utf8");

  const system = [
    `You write minimal, safe ${shell} scripts for ${env} admin tasks.`,
    `Call the tool with ONLY the full script as its input. No commentary or fences in the tool input. Do not output anything else.`,
  ].join("\n");

  const user = [
    `Task: ${task}`,
    `Environment: ${env}`,
    `OS: ${isWindows ? "windows" : "unix"}`,
  ].join("\n");

  const toolName = env === "gam" ? "execute_gam" : "execute_m365";
  const tools: any[] = [{
    type: "custom",
    name: toolName,
    description: `Execute a ${shell} script for ${env}. The tool input MUST be exactly the full script to run.`,
    format: { type: "grammar", syntax: "lark", definition: grammarText },
  }];

  const response: any = opts?.useCache
    ? DEV_CACHED_RESPONSE
    : await openai.responses.create({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools,
        tool_choice: { type: "custom", name: toolName },
      });

  // Extract tool input as the script
  const outputBlocks = (response as any).output as Array<{ type: string; [key: string]: any }> | undefined;
  const outputText = (response as any).output_text ?? "";
  if (Array.isArray(outputBlocks)) {
    for (const block of outputBlocks) {
      const t = (block as any).type;
      const n = (block as any).name;
      if ((t === "tool_call" || t === "tool_use" || t === "custom_tool_call") && n === toolName) {
        const args = (block as any).arguments ?? (block as any).input;
        if (typeof args === "string" && args.trim().length > 0) return { script: args.trim(), text: outputText, raw: response };
        if (args && typeof args === "object") {
          const maybe = (args.input ?? args.code ?? args.script ?? args.text ?? "").toString();
          if (maybe.trim().length > 0) return { script: maybe.trim(), text: outputText, raw: response };
        }
      }
    }
  }

  // Return any textual output even if the tool wasn't called
  return { script: "", text: outputText, raw: response };
}


