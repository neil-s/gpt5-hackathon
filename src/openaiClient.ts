import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type SupportedEnv = "m365" | "gam";

const DEV_CACHED_RESPONSE: any = {
  id: "resp_6898e730efa081909b538898725878430fea027f7994a7dc",
  object: "response",
  created_at: 1754851125,
  status: "completed",
  background: false,
  error: null,
  incomplete_details: null,
  instructions: null,
  max_output_tokens: null,
  max_tool_calls: null,
  model: "gpt-5-2025-08-07",
  output: [
    {
      id: "rs_6898e735b2748190835f6314c0bd800f0fea027f7994a7dc",
      type: "reasoning",
      summary: [
        {
          type: "summary_text",
          text: "**Reviewing function tool grammar**\n\nI’m looking at the exact grammar of our functions tool, which has a limited set of commands like creating or deleting users and groups. It doesn’t support 2FA commands. Since our context indicates targeting \"gam,\" the grammar is simplified, meaning I can't send commands like \"gam update user EMAIL 2sv on.\" We can only create users, add them to groups, and we need a password value, so I may need to generate a temporary password.",
        },
        {
          type: "summary_text",
          text: "**Considering password setup and 2FA**\n\nI think I can set up a secure temporary password and require the user to change it at their next login. I could use something like “Temp#2025!Onboard” for consistency, but I'm a bit unsure about the environment. The tool grammar doesn’t allow for setting up 2FA, but I can instruct the user to enforce 2SV separately. I should also note to the user how to update their account with the necessary command, but I'll need clarification on whether to include it in my script.",
        },
        {
          type: "summary_text",
          text: "**Planning function execution and password**\n\nIt seems there's a need for a follow-up on the 2FA policy. However, I must call the function immediately. I also need to add the user to the engineers@ group, likely engineers@joinrollout.ai. We're not creating a group here, just adding a member, and printing group members isn't necessary. I need to choose a password, so I’ll go with \"TempPass#2025\" which has the right length and complexity. This should be secure enough!",
        },
        {
          type: "summary_text",
          text: "**Finalizing user creation and 2FA enforcement**\n\nI’ll set \"changepassword on\" and also include the user's first and last names: Neil Satra. The script lines I’ll need are: \n\n- `gam create user neil@joinrollout.ai firstname \"Neil\" lastname \"Satra\" password \"TempPass#2025\" changepassword on`\n- `gam update group engineers@joinrollout.ai add member neil@joinrollout.ai`\n\nI can't enforce 2FA directly through this tool, so I'll mention that in the summary and ask if they want to run an additional command for it. Lastly, I’ll begin with a concise checklist to interpret the user's goals clearly.",
        },
        {
          type: "summary_text",
          text: "**Preparing script and user onboarding**\n\nI’ll provide a plain English summary after the tool run, focusing on what the script does. The developer says I need to call the function directly without commentary, but I can include a preamble based on previous instructions. \n\nFirst, I’ll interpret the user’s goal to onboard Neil Satra by creating an account, adding them to the engineers group, and enforcing 2FA. \n\nMy checklist includes:\n- Create the account with a temporary password.\n- Add the user to the engineers group.\n- Follow up on enforcing 2FA.\n\nFinally, I'll run the necessary commands while ensuring the email formats are correct.",
        },
      ],
    },
    {
      id: "ctc_6898e74a7a7481909666052c9a6936d00fea027f7994a7dc",
      type: "custom_tool_call",
      status: "completed",
      call_id: "call_XEabqEL94VLXfoDOsqnOJByZ",
      input:
        "gam create user neil@joinrollout.ai firstname \"Neil\" lastname \"Satra\" password \"TempPass#2025\" changepassword on\n" +
        "gam update group engineers@joinrollout.ai add member neil@joinrollout.ai",
      name: "execute_gam",
    },
  ],
  parallel_tool_calls: true,
  previous_response_id: null,
  prompt_cache_key: null,
  reasoning: {
    effort: "medium",
    summary: "detailed",
  },
  safety_identifier: null,
  service_tier: "default",
  store: true,
  temperature: 1,
  text: {
    format: {
      type: "text",
    },
    verbosity: "medium",
  },
  tool_choice: {
    type: "custom",
    name: "execute_gam",
  },
  tools: [
    {
      type: "custom",
      description: "Execute a bash script for gam. The tool input MUST be exactly the full script to run.",
      format: {
        type: "grammar",
        definition:
          "start: script\n\n" +
          "script: command (NL command)* NL?\n\n" +
          "command: create_user\n       | delete_user\n       | suspend_user\n       | unsuspend_user\n       | add_group_member\n       | remove_group_member\n       | create_group\n       | delete_group\n       | print_users\n       | print_groups\n       | print_group_members\n\n" +
          "create_user: \"gam\" \"create\" \"user\" EMAIL \"firstname\" QSTR \"lastname\" QSTR \"password\" QSTR (\"org\" ORGPATH)? (\"changepassword\" onoff)?\n\n" +
          "delete_user: \"gam\" \"delete\" \"user\" EMAIL\n\n" +
          "suspend_user: \"gam\" \"update\" \"user\" EMAIL \"suspended\" \"on\"\n\n" +
          "unsuspend_user: \"gam\" \"update\" \"user\" EMAIL \"suspended\" \"off\"\n\n" +
          "add_group_member: \"gam\" \"update\" \"group\" EMAIL \"add\" \"member\" EMAIL\n\n" +
          "remove_group_member: \"gam\" \"update\" \"group\" EMAIL \"remove\" \"member\" EMAIL\n\n" +
          "create_group: \"gam\" \"create\" \"group\" EMAIL \"name\" QSTR (\"description\" QSTR)?\n\n" +
          "delete_group: \"gam\" \"delete\" \"group\" EMAIL\n\n" +
          "print_users: \"gam\" \"print\" \"users\"\n\n" +
          "print_groups: \"gam\" \"print\" \"groups\"\n\n" +
          "print_group_members: \"gam\" \"print\" \"group-members\" \"group\" EMAIL\n\n" +
          "onoff: \"on\" | \"off\"\n\n" +
          "EMAIL: /[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,10}/\n" +
          "ORGPATH: /\\/?[A-Za-z0-9._\\-]+(\\/[A-Za-z0-9._\\-]+)*/\n" +
          "QSTR: /\"([^\"\\\\]|\\\\.)*\"/\n" +
          "NL: /\\r?\\n/\n" +
          "WS_INLINE: /[ \\t]+/\n" +
          "%ignore WS_INLINE\n\n\n",
        syntax: "lark",
      },
      name: "execute_gam",
    },
  ],
  top_logprobs: 0,
  top_p: 1,
  truncation: "disabled",
  usage: {
    input_tokens: 883,
    input_tokens_details: {
      cached_tokens: 0,
    },
    output_tokens: 2048,
    output_tokens_details: {
      reasoning_tokens: 1984,
    },
    total_tokens: 2931,
  },
  user: null,
  metadata: {},
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
    // Primary: match the expected tool name for this env
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
    // Fallback: use the first tool call block that contains a string script, even if tool name differs
    for (const block of outputBlocks) {
      const t = (block as any).type;
      if (t === "tool_call" || t === "tool_use" || t === "custom_tool_call") {
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


