import { useState } from "react";

export function App() {
  const [env, setEnv] = useState<"m365" | "gam">("gam");
  const [task, setTask] = useState("Add a new user, Neil Satra. neil@joinrollout.ai. Use sensible defaults for all other required parameters");
  const [script, setScript] = useState("");
  const [modelText, setModelText] = useState("");
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useCache, setUseCache] = useState(true);

  async function generate() {
    setError(null);
    setScript("");
    setModelText("");
    setLoading(true);
    try {
      const res = await fetch(`/generate?cache=${useCache ? "1" : "0"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env, task }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          msg = `${msg}: ${errJson?.message || errJson?.error || JSON.stringify(errJson)}`;
        } catch {
          const txt = await res.text();
          if (txt) msg = `${msg}: ${txt}`;
        }
        setError(msg);
        return;
      }
      const data = await res.json();
      setScript(data.shell_script || "");
      setModelText(data.model_text || "");
      setRaw(data.raw || null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
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
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={useCache} onChange={(e) => setUseCache(e.target.checked)} />
          Use cached response
        </label>
        <button onClick={generate} disabled={loading || !task.trim()}>{loading ? "Generating..." : "Generate"}</button>
      </div>
      {error && (
        <div style={{ marginTop: 12, color: "#b91c1c", background: "#fee2e2", padding: 8, borderRadius: 6 }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {(script || modelText || raw) && (
        <div style={{ marginTop: 16 }}>
          <h3>OpenAI Response</h3>
          {script && (
            <div style={{ marginTop: 8 }}>
              <div><strong>Script</strong></div>
              <pre>{script}</pre>
            </div>
          )}
          {modelText && (
            <div style={{ marginTop: 8 }}>
              <div><strong>Text</strong></div>
              <pre>{modelText}</pre>
            </div>
          )}
          {raw && (
            <div style={{ marginTop: 8 }}>
              <div><strong>Raw</strong></div>
              <pre style={{ overflow: 'auto' }}>{JSON.stringify(raw, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

