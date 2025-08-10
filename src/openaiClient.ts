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

export interface BuiltOpenAIRequest {
  model: string;
  shell: string;
  toolName: string;
  inputMessages: Array<{ role: "developer" | "user"; content: string }>;
  tools: any[];
  tool_choice: any;
  variables: Record<string, string>;
}

export async function buildOpenAIRequest(env: SupportedEnv, task: string): Promise<BuiltOpenAIRequest> {
  const isWindows = os.platform() === "win32";
  const shell = isWindows ? "PowerShell" : "bash";
  const model = process.env.OPENAI_MODEL || "gpt-5";

  // Load Lark grammar for the selected environment
  const grammarPath = path.resolve(process.cwd(), "cfg", `${env}.lark`);
  const grammarText = await fs.readFile(grammarPath, "utf8");

  const shellLabel = isWindows ? "PowerShell" : "bash";
  const envLabel = env === "gam" ? "GAM" : "Microsoft 365";
  const osLabel = isWindows ? "Windows" : "Unix";

  const system = [
    `Developer: # Role and Objective`,
    `- Generate minimal and safe {shell} scripts for {env_label} admin tasks, tailored to user requests.`,
    ``,
    `# Instructions`,
    `- Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.`,
    `- Always interpret the user's goal and rewrite it at the start in clear, friendly language (do not include this rephrasing in the script provided to the tool).`,
    `- Provide the tool only with the complete script; omit all commentary, markdown, or code fences.`,
    `- Upon completion, provide a plain English summary explaining what the script does and the logic behind it.`,
    `- After providing the script, review to ensure that it is minimal, correct, and safe; self-correct if needed before finalizing your summary.`,
    `- Scripts should be minimal, correct, and safe.`,
    ``,
    `# Context`,
    `- Target environment: \`{env}\` tool`,
    `- Operating system: {os_label}`,
    `- Example: Given the user request to add a new user "Rahul Dewan," script should use the appropriate {env_label} commands.`,
    `- Out-of-scope: Do not generate scripts unrelated to {env_label} admin tasks.`,
    ``,
    `# Output Format`,
    `- Provide the {shell} script as plain text directly to the tool (no commentary, no markdown/code blocks, no extra lines).`,
    `- Provide explanations and all user-facing content outside the tool input section.`,
    ``,
    `# Verbosity`,
    `- Scripts: minimal.`,
    `- Explanations: concise and clear.`,
    ``,
    `# Stop Conditions`,
    `- Task is finished when the script is provided and its logic clearly summarized in plain English.`,
    `- If the user request is not actionable, ask for clarification before proceeding.`,
  ].join("\n");

  const user = [`Task: ${task}`].join("\n");

  const toolName = env === "gam" ? "execute_gam" : "execute_m365";
  const tools: any[] = [{
    type: "custom",
    name: toolName,
    description: `Execute a ${shell} script for ${env}. The tool input MUST be exactly the full script to run.`,
    format: { type: "grammar", syntax: "lark", definition: grammarText },
  }];

  const inputMessages: Array<{ role: "developer" | "user"; content: string }> = [
    { role: "developer", content: system },
    { role: "user", content: user },
  ];

  const variables: Record<string, string> = {
    shell: shellLabel,
    env,
    env_label: envLabel,
    os_label: osLabel,
  };

  return { model, shell, toolName, inputMessages, tools, tool_choice: { type: "custom", name: toolName }, variables };
}

export async function generateScript(env: SupportedEnv, task: string, opts?: { useCache?: boolean }): Promise<{ script: string; text: string; raw: any; inputMessages: BuiltOpenAIRequest["inputMessages"] }> {
  const built = await buildOpenAIRequest(env, task);

  // The official SDK may not support `variables` yet; perform local substitution
  const resolvedMessages = built.inputMessages.map((m) => {
    if (m.role !== "developer") return m;
    let text = m.content;
    for (const [k, v] of Object.entries(built.variables)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
    return { ...m, content: text } as typeof m;
  });

  const response: any = opts?.useCache
    ? DEV_CACHED_RESPONSE
    : await openai.responses.create({
        model: built.model,
        reasoning: { effort: "medium", summary: "detailed" },
        input: resolvedMessages,
        tools: built.tools,
        tool_choice: built.tool_choice,
      });

  // Extract tool input as the script
  const outputBlocks = (response as any).output as Array<{ type: string; [key: string]: any }> | undefined;
  const outputText = (response as any).output_text ?? "";
  if (Array.isArray(outputBlocks)) {
    for (const block of outputBlocks) {
      const t = (block as any).type;
      const n = (block as any).name;
      if ((t === "tool_call" || t === "tool_use" || t === "custom_tool_call") && n === built.toolName) {
        const args = (block as any).arguments ?? (block as any).input;
        if (typeof args === "string" && args.trim().length > 0) return { script: args.trim(), text: outputText, raw: response, inputMessages: built.inputMessages };
        if (args && typeof args === "object") {
          const maybe = (args.input ?? args.code ?? args.script ?? args.text ?? "").toString();
          if (maybe.trim().length > 0) return { script: maybe.trim(), text: outputText, raw: response, inputMessages: built.inputMessages };
        }
      }
    }
  }

  // Return any textual output even if the tool wasn't called
  return { script: "", text: outputText, raw: response, inputMessages: resolvedMessages };
}


