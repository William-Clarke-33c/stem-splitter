import { useEffect, useState, useRef } from "react";

const STEM_ICONS = { vocals: "🎤", drums: "🥁", bass: "🎸", other: "🎹" };
const STEM_LABELS = { vocals: "Vocals", drums: "Drums", bass: "Bass", other: "Other" };
const STEM_COLORS = { vocals: "#a78bfa", drums: "#f472b6", bass: "#34d399", other: "#60a5fa" };

function fmt(secs) {
  if (!isFinite(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StemCard({ jobId, stem }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const audioRef = useRef(null);
  const barRef = useRef(null);
  const url = `/api/stems/${jobId}/${stem}`;
  const color = STEM_COLORS[stem];

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    playing ? audio.pause() : audio.play();
  };

  const seek = (e) => {
    const bar = barRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const onMouseDown = (e) => {
    setDragging(true);
    seek(e);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => seek(e);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, duration]);

  const progress = duration ? currentTime / duration : 0;

  return (
    <div style={{
      background: "#1a1a1f",
      border: "1px solid #2a2a30",
      borderRadius: 12,
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
      />

      {/* Play/Pause */}
      <button
        onClick={toggle}
        style={{
          width: 38, height: 38, borderRadius: "50%",
          background: playing ? color : "#2a2a35",
          border: "none", cursor: "pointer", fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "background 0.15s",
          color: playing ? "#000" : "#ccc",
        }}
      >
        {playing ? "⏸" : "▶"}
      </button>

      {/* Label */}
      <div style={{ flexShrink: 0, width: 80 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#ddd" }}>
          {STEM_ICONS[stem]} {STEM_LABELS[stem]}
        </div>
      </div>

      {/* Seek bar + time */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Bar */}
        <div
          ref={barRef}
          onMouseDown={onMouseDown}
          style={{
            height: 4, borderRadius: 2, background: "#2e2e38",
            cursor: "pointer", position: "relative", overflow: "visible",
          }}
        >
          {/* Filled */}
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${progress * 100}%`,
            background: color,
            borderRadius: 2,
            transition: dragging ? "none" : "width 0.1s linear",
          }} />
          {/* Thumb */}
          <div style={{
            position: "absolute",
            left: `${progress * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 10, height: 10,
            borderRadius: "50%",
            background: color,
            opacity: playing || dragging ? 1 : 0,
            transition: "opacity 0.15s",
            pointerEvents: "none",
          }} />
        </div>
        {/* Time */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555" }}>
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Download */}
      <a
        href={url}
        download
        style={{
          padding: "5px 12px",
          background: "#2a2a35",
          color: "#aaa",
          borderRadius: 8,
          fontSize: 12,
          textDecoration: "none",
          fontWeight: 500,
          flexShrink: 0,
          transition: "background 0.15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = "#3a3a45")}
        onMouseOut={(e) => (e.currentTarget.style.background = "#2a2a35")}
      >
        Download
      </a>
    </div>
  );
}

export default function JobStatus({ jobId, filename }) {
  const [job, setJob] = useState({ status: "pending", stems: [] });
  const intervalRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        setJob(data);
        if (data.status === "done" || data.status === "error") {
          clearInterval(intervalRef.current);
        }
      } catch {
        // ignore transient fetch errors
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => clearInterval(intervalRef.current);
  }, [jobId]);

  const statusColor = {
    pending: "#888",
    processing: "#f59e0b",
    done: "#34d399",
    error: "#f87171",
  }[job.status] ?? "#888";

  const statusLabel = {
    pending: "Queued…",
    processing: "Splitting stems — this can take a few minutes…",
    done: "Done",
    error: "Failed",
  }[job.status] ?? job.status;

  return (
    <div style={{
      background: "#14141a",
      border: "1px solid #222228",
      borderRadius: 16,
      padding: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: job.status === "done" ? 20 : 0 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: "#ddd", wordBreak: "break-all" }}>
            {filename}
          </p>
          <p style={{ fontSize: 13, color: statusColor, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
            {job.status === "processing" && <Spinner />}
            {statusLabel}
          </p>
        </div>
      </div>

      {job.status === "error" && job.error && (
        <p style={{ fontSize: 12, color: "#f87171", background: "#1f1015", borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
          {job.error}
        </p>
      )}

      {job.status === "done" && job.stems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {job.stems.map((stem) => (
            <StemCard key={stem} jobId={jobId} stem={stem} />
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: 10, height: 10,
      border: "2px solid #f59e0b",
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
}

if (typeof document !== "undefined" && !document.getElementById("spin-style")) {
  const s = document.createElement("style");
  s.id = "spin-style";
  s.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}
