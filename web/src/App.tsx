import { useEffect, useState } from "react";

export function App() {
  const [env, setEnv] = useState<"m365" | "gam">("gam");
  const [task, setTask] = useState("Add a new user, Neil Satra. neil@joinrollout.ai. Use sensible defaults for all other required parameters");
  const [script, setScript] = useState("");
  const [modelText, setModelText] = useState("");
  const [raw, setRaw] = useState<any>(null);
  const [inputMessages, setInputMessages] = useState<Array<{ role: "system" | "user"; content: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useCache, setUseCache] = useState(true);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setError(null);
    setScript("");
    setModelText("");
    setRaw(null);
    setInputMessages(null);
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
      setInputMessages(data.input_messages || null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div
      style={{
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>GPT-5 Admin Assistant</h1>
            <div style={{ color: "#475569", marginTop: 4 }}>Generate admin scripts for Google Workspace and Microsoft 365</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "stretch",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", fontSize: 12, color: "#475569", gap: 6, minWidth: 220 }}>
            Environment
            <select
              value={env}
              onChange={(e) => setEnv(e.target.value as any)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                outline: "none",
                background: "#fff",
                color: "#0f172a",
              }}
            >
              <option value="gam">Google Workspace</option>
              <option value="m365">Microsoft 365</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", flex: 1, fontSize: 12, color: "#475569", gap: 6 }}>
            Task
            <input
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                outline: "none",
                background: "#fff",
                color: "#0f172a",
              }}
              placeholder="Describe your admin task..."
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#0f172a", padding: 8 }}>
            <input type="checkbox" checked={useCache} onChange={(e) => setUseCache(e.target.checked)} />
            Use cache
          </label>
          <button
            onClick={generate}
            disabled={loading || !task.trim()}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #3b82f6",
              background: loading || !task.trim() ? "#93c5fd" : "#3b82f6",
              color: "white",
              cursor: loading || !task.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
              minWidth: 120,
            }}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              color: "#b91c1c",
              background: "#fee2e2",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #fecaca",
            }}
          >
            <strong style={{ marginRight: 4 }}>Error:</strong> {error}
          </div>
        )}

        {(script || modelText || raw || inputMessages) && (
          <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
            {script && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600 }}>Script</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {copied && <span style={{ fontSize: 12, color: "#16a34a" }}>Copied</span>}
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(script);
                          setCopied(true);
                        } catch {}
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#f1f5f9",
                        color: "#0f172a",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: 14,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    overflow: "auto",
                    fontSize: 13,
                  }}
                ><code>{script}</code></pre>
              </div>
            )}

            {(inputMessages || modelText || raw) && (
              <details
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
                  overflow: "hidden",
                }}
              >
                <summary style={{ padding: "12px 14px", cursor: "pointer", userSelect: "none", fontWeight: 600 }}>
                  Debug
                </summary>
                <div style={{ padding: 14, display: "grid", gap: 16 }}>
                  {inputMessages && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Input sent to OpenAI</div>
                      <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
                        {inputMessages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n")}
                      </pre>
                    </div>
                  )}
                  {modelText && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Model Text</div>
                      <pre style={{ margin: 0, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>{modelText}</pre>
                    </div>
                  )}
                  {raw && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Raw JSON</div>
                      <pre style={{ margin: 0, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, overflow: "auto" }}>
                        {JSON.stringify(raw, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

