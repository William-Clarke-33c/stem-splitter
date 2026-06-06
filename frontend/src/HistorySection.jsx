import { useState } from "react";

const STEM_ICONS = { vocals: "🎤", drums: "🥁", bass: "🎸", other: "🎹", piano: "🎹", guitar: "🎸" };
const MODEL_COLORS = {
  htdemucs: "#7c6ff7",
  htdemucs_ft: "#f472b6",
  htdemucs_6s: "#34d399",
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function HistoryCard({ entry, onRemove }) {
  const ext = entry.format === "mp3" ? ".mp3" : entry.format === "flac" ? ".flac" : ".wav";
  const color = MODEL_COLORS[entry.model] ?? "#888";

  return (
    <div style={{
      background: "#14141a",
      border: "1px solid #1e1e26",
      borderRadius: 12,
      padding: "14px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontWeight: 600, fontSize: 14, color: "#ccc",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {entry.filename}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, color: color,
              background: `${color}18`, borderRadius: 4,
              padding: "2px 6px", letterSpacing: "0.3px",
            }}>
              {entry.model}
            </span>
            <span style={{ fontSize: 11, color: "#444" }}>{entry.format?.toUpperCase()}</span>
            {entry.trimStart != null && (
              <span style={{ fontSize: 11, color: "#444" }}>
                {entry.trimStart}s – {entry.trimEnd}s
              </span>
            )}
            <span style={{ fontSize: 11, color: "#333" }}>{timeAgo(entry.completedAt)}</span>
          </div>
        </div>

        <button
          onClick={() => onRemove(entry.jobId)}
          title="Remove from history"
          style={{
            background: "none", border: "none", color: "#333",
            cursor: "pointer", fontSize: 15, padding: 2, lineHeight: 1,
            transition: "color 0.15s", flexShrink: 0,
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#666")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#333")}
        >
          ✕
        </button>
      </div>

      {/* Stem download chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {entry.stems.map((stem) => (
          <a
            key={stem}
            href={`/api/stems/${entry.jobId}/${stem}`}
            download={`${entry.trackName}_${stem}${ext}`}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px",
              background: "#1e1e28", border: "1px solid #2a2a35",
              borderRadius: 8, textDecoration: "none",
              fontSize: 12, color: "#aaa", fontWeight: 500,
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#2a2a38";
              e.currentTarget.style.borderColor = "#3a3a48";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#1e1e28";
              e.currentTarget.style.borderColor = "#2a2a35";
            }}
          >
            {STEM_ICONS[stem] ?? "🎵"} {stem}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function HistorySection({ history, onRemove, onClear }) {
  const [collapsed, setCollapsed] = useState(false);

  if (history.length === 0) return null;

  return (
    <div style={{ marginTop: 40 }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        marginBottom: collapsed ? 0 : 14,
      }}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, padding: 0,
          }}
        >
          <span style={{
            fontSize: 11, color: "#444",
            display: "inline-block",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}>▼</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#888" }}>History</span>
          <span style={{
            fontSize: 11, background: "#1e1e26", color: "#555",
            borderRadius: 10, padding: "2px 7px",
          }}>
            {history.length}
          </span>
        </button>

        <div style={{ flex: 1 }} />

        {!collapsed && (
          <button
            onClick={onClear}
            style={{
              background: "none", border: "none",
              color: "#444", fontSize: 12, cursor: "pointer",
              transition: "color 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#888")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#444")}
          >
            Clear all
          </button>
        )}
      </div>

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((entry) => (
            <HistoryCard key={entry.jobId} entry={entry} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
