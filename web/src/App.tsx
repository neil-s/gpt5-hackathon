import { useState } from "react";

export function App() {
  const [env, setEnv] = useState<"m365" | "gam">("m365");
  const [task, setTask] = useState("");
  const [preamble, setPreamble] = useState("");
  const [script, setScript] = useState("");

  async function generate() {
    const res = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env, task, dry_run: true }),
    });
    const data = await res.json();
    setPreamble(data.preamble || "");
    setScript(data.shell_script || "");
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 16 }}>
      <h1>GPT-5 Admin Assistant</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          Environment:
          <select value={env} onChange={(e) => setEnv(e.target.value as any)}>
            <option value="m365">m365</option>
            <option value="gam">gam</option>
          </select>
        </label>
        <input
          style={{ flex: 1 }}
          placeholder="Describe your admin task..."
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
        <button onClick={generate}>Generate</button>
      </div>
      {preamble && (
        <div style={{ marginTop: 16 }}>
          <h3>Preamble</h3>
          <pre>{preamble}</pre>
        </div>
      )}
      {script && (
        <div style={{ marginTop: 16 }}>
          <h3>Generated Script</h3>
          <pre>{script}</pre>
        </div>
      )}
    </div>
  );
}

