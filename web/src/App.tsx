import { useEffect, useState } from "react";

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightScript(code: string, env: "m365" | "gam"): string {
  let html = escapeHtml(code);

  const placeholders: string[] = [];
  const replaceWithPlaceholder = (value: string): string => {
    const token = `__TOKEN_${placeholders.length}__`;
    placeholders.push(value);
    return token;
  };

  // Protect strings first
  html = html.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, (m) => replaceWithPlaceholder(`<span class=\"str\">${m}</span>`));
  html = html.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, (m) => replaceWithPlaceholder(`<span class=\"str\">${m}</span>`));

  // Protect comments
  html = html.replace(/(^|\n)([^\S\n]*#.*)(?=\n|$)/g, (_m, p1: string, p2: string) => `${p1}${replaceWithPlaceholder(`<span class=\"com\">${p2}</span>`)}`);

  if (env === "m365") {
    // PowerShell-like highlighting
    html = html.replace(/\b(?:Get|Set|New|Remove|Add|Update|Grant|Revoke|Connect|Disconnect|Enable|Disable)-[A-Za-z][A-Za-z0-9]*\b/g, (m) => `<span class=\"cmd\">${m}</span>`);
    html = html.replace(/(^|\s)(-[A-Za-z][A-Za-z0-9-]*)/g, (_m, p1: string, p2: string) => `${p1}<span class=\"param\">${p2}</span>`);
    html = html.replace(/\$[A-Za-z_][A-Za-z0-9_\.:]*/g, (m) => `<span class=\"var\">${m}</span>`);
    html = html.replace(/\b(?:if|elseif|else|foreach|for|while|switch|function|param|return|try|catch|finally)\b/g, (m) => `<span class=\"kw\">${m}</span>`);
    html = html.replace(/\b\d+\b/g, (m) => `<span class=\"num\">${m}</span>`);
  } else {
    // Bash/GAM-like highlighting
    html = html.replace(/\b(?:sudo|echo|export|set|cd|mkdir|rm|cp|mv|grep|awk|sed|curl|wget|gam)\b/g, (m) => `<span class=\"cmd\">${m}</span>`);
    html = html.replace(/(^|\s)(--?[A-Za-z][A-Za-z0-9-_]*)/g, (_m, p1: string, p2: string) => `${p1}<span class=\"param\">${p2}</span>`);
    html = html.replace(/\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*|\$\d+/g, (m) => `<span class=\"var\">${m}</span>`);
    html = html.replace(/\b(?:if|then|else|elif|fi|for|in|do|done|while|case|esac|function|return|exit)\b/g, (m) => `<span class=\"kw\">${m}</span>`);
    html = html.replace(/\b\d+\b/g, (m) => `<span class=\"num\">${m}</span>`);
  }

  // Restore placeholders
  placeholders.forEach((value, i) => {
    const token = new RegExp(`__TOKEN_${i}__`, "g");
    html = html.replace(token, value);
  });

  return html;
}

export function App() {
  const [env, setEnv] = useState<"m365" | "gam">("gam");
  const [task, setTask] = useState("We're onboarding a new employee, Neil Satra. Give them the email neil@joinrollout.ai, add them to the engineers@ group, and require 2FA");
  const [script, setScript] = useState("");
  const [modelText, setModelText] = useState("");
  const [raw, setRaw] = useState<any>(null);
  const [reasoning, setReasoning] = useState("");
  const [inputMessages, setInputMessages] = useState<Array<{ role: "system" | "user"; content: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useCache, setUseCache] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showExecuteToast, setShowExecuteToast] = useState(false);

  async function generate() {
    setError(null);
    setScript("");
    setModelText("");
    setRaw(null);
    setReasoning("");
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
      // Extract reasoning from OpenAI Responses API shape if present
      try {
        const extractReasoning = (r: any): string => {
          if (!r) return "";
          const blocks = (r as any).output;
          if (Array.isArray(blocks)) {
            const texts: string[] = [];
            for (const b of blocks) {
              if (b && b.type === "reasoning") {
                if (Array.isArray(b.summary)) {
                  for (const s of b.summary) {
                    const t = (s && (s.text || s.content || s.message)) as string | undefined;
                    if (t && t.trim()) texts.push(t.trim());
                  }
                }
                if (typeof b.text === "string" && b.text.trim()) texts.push(b.text.trim());
                if (Array.isArray((b as any).steps)) {
                  for (const step of (b as any).steps) {
                    const t = step && (step.text || step.content);
                    if (t && String(t).trim()) texts.push(String(t).trim());
                  }
                }
              }
            }
            if (texts.length) return texts.join("\n\n");
          }
          return "";
        };
        setReasoning(extractReasoning(data.raw));
      } catch {}
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

  useEffect(() => {
    if (!showExecuteToast) return;
    const t = setTimeout(() => setShowExecuteToast(false), 2000);
    return () => clearTimeout(t);
  }, [showExecuteToast]);

  const handleExecute = () => {
    setShowExecuteToast(true);
  };

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
            alignItems: "flex-start",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 220, flex: "0 0 240px" }}>
            <label style={{ display: "flex", flexDirection: "column", fontSize: 12, color: "#475569", gap: 6 }}>
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
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#0f172a", padding: 8 }}>
              <input type="checkbox" checked={useCache} onChange={(e) => setUseCache(e.target.checked)} />
              Use cache
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 300px", minWidth: 0 }}>
            <label style={{ display: "flex", flexDirection: "column", fontSize: 12, color: "#475569", gap: 6 }}>
              Task
              <textarea
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  background: "#fff",
                  color: "#0f172a",
                  width: "100%",
                  maxWidth: "100%",
                  minHeight: 120,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
                placeholder="Describe your admin task..."
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={4}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
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
          </div>
        </div>

        {showExecuteToast && (
          <div
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              background: "#10b981",
              color: "white",
              padding: "12px 16px",
              borderRadius: 8,
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              zIndex: 1000,
              fontWeight: 500,
            }}
          >
            Executing script
          </div>
        )}

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
                    <button
                      onClick={handleExecute}
                      disabled={loading || !script.trim()}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #3b82f6",
                        background: loading || !script.trim() ? "#93c5fd" : "#3b82f6",
                        color: "white",
                        cursor: loading || !script.trim() ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Execute
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
                    whiteSpace: "pre-wrap",
                    maxWidth: "100%",
                  }}
                >
                  <code
                    className="hl"
                    style={{ display: "block", whiteSpace: "inherit", wordBreak: "break-word", overflowWrap: "anywhere" }}
                    dangerouslySetInnerHTML={{ __html: highlightScript(script, env) }}
                  />
                </pre>
              </div>
            )}

            {reasoning && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>Reasoning</div>
                <div style={{ padding: 16 }}>
                  <div style={{ 
                    background: "#f8fafc", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: 8, 
                    padding: 16,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "#334155"
                  }}>
                    {reasoning.split('\n\n').map((paragraph, index) => {
                      // Check if this looks like a summary item (starts with **)
                      if (paragraph.trim().startsWith('**') && paragraph.trim().endsWith('**')) {
                        return (
                          <div key={index} style={{ 
                            marginBottom: index < reasoning.split('\n\n').length - 1 ? 16 : 0,
                            fontWeight: 600,
                            color: "#1e293b",
                            fontSize: 15
                          }}>
                            {paragraph}
                          </div>
                        );
                      }
                      // Check if it's a bullet point or numbered item
                      if (paragraph.trim().startsWith('-') || paragraph.trim().startsWith('•') || /^\d+\./.test(paragraph.trim())) {
                        return (
                          <div key={index} style={{ 
                            marginBottom: index < reasoning.split('\n\n').length - 1 ? 12 : 0,
                            paddingLeft: 16,
                            position: 'relative'
                          }}>
                            <span style={{ 
                              position: 'absolute', 
                              left: 0, 
                              color: '#64748b',
                              fontWeight: 500
                            }}>•</span>
                            <span style={{ paddingLeft: 8 }}>{paragraph.trim().replace(/^[-•\d+\.\s]+/, '')}</span>
                          </div>
                        );
                      }
                      // Regular paragraph
                      return (
                        <div key={index} style={{ 
                          marginBottom: index < reasoning.split('\n\n').length - 1 ? 12 : 0,
                          textAlign: 'justify'
                        }}>
                          {paragraph}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
                      <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, overflow: "auto", maxWidth: "100%", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        {inputMessages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n")}
                      </pre>
                    </div>
                  )}
                  {modelText && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Model Text</div>
                      <pre style={{ margin: 0, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, whiteSpace: "pre-wrap", overflow: "auto", maxWidth: "100%", wordBreak: "break-word", overflowWrap: "anywhere" }}>{modelText}</pre>
                    </div>
                  )}
                  {raw && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Raw JSON</div>
                      <pre style={{ margin: 0, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, overflow: "auto", maxWidth: "100%", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        {JSON.stringify(raw, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
        {/* Inline tiny CSS for the highlighter */}
        <style>
          {`
          code.hl { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
          code.hl .kw { color: #93c5fd; }
          code.hl .cmd { color: #60a5fa; }
          code.hl .param { color: #a5b4fc; }
          code.hl .var { color: #facc15; }
          code.hl .str { color: #86efac; }
          code.hl .com { color: #94a3b8; font-style: italic; }
          code.hl .num { color: #fda4af; }
          `}
        </style>
      </div>
    </div>
  );
}

