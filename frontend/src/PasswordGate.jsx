import { useState } from "react";
import { setPassword } from "./api.js";

export default function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setChecking(true);
    setError(false);

    try {
      const res = await fetch("/api/health", {
        headers: { "x-access-password": value.trim() },
      });
      if (res.ok) {
        setPassword(value.trim());
        onUnlock();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#0f0f11",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100,
    }}>
      <div style={{
        background: "#14141a",
        border: "1px solid #222228",
        borderRadius: 16,
        padding: "36px 40px",
        width: "100%",
        maxWidth: 380,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontWeight: 700, fontSize: 20, color: "#fff", marginBottom: 6 }}>
          Password required
        </h2>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 24 }}>
          Enter the access password to continue.
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            placeholder="Password"
            autoFocus
            style={{
              background: "#1a1a1f",
              border: `1px solid ${error ? "#f87171" : "#2e2e3a"}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: "#ddd",
              fontSize: 14,
              outline: "none",
              width: "100%",
            }}
          />
          {error && (
            <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>Incorrect password.</p>
          )}
          <button
            type="submit"
            disabled={checking || !value.trim()}
            style={{
              padding: "10px",
              background: "#7c6ff7",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              opacity: checking || !value.trim() ? 0.5 : 1,
            }}
          >
            {checking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
