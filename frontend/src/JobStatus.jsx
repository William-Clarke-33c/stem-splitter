import { useEffect, useState, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

const STEM_ICONS   = { vocals: "🎤", drums: "🥁", bass: "🎸", other: "🎹" };
const STEM_LABELS  = { vocals: "Vocals", drums: "Drums", bass: "Bass", other: "Other" };
const STEM_COLORS  = { vocals: "#a78bfa", drums: "#f472b6", bass: "#34d399", other: "#60a5fa" };

function fmt(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StemCard({ jobId, stem }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const url = `/api/stems/${jobId}/${stem}`;
  const color = STEM_COLORS[stem];

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#2a2a38",
      progressColor: color,
      url,
      height: 44,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
      backend: "WebAudio",
    });

    ws.on("ready",      (d) => { setDuration(d); setReady(true); });
    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("play",       ()  => setPlaying(true));
    ws.on("pause",      ()  => setPlaying(false));
    ws.on("finish",     ()  => setPlaying(false));

    wsRef.current = ws;
    return () => ws.destroy();
  }, [url, color]);

  const toggle = () => wsRef.current?.playPause();

  const onVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    wsRef.current?.setVolume(v);
    if (muted && v > 0) { setMuted(false); wsRef.current?.setMuted(false); }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    wsRef.current?.setMuted(next);
  };

  return (
    <div style={{
      background: "#1a1a1f",
      border: "1px solid #2a2a30",
      borderRadius: 12,
      padding: "14px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Play/pause */}
        <button
          onClick={toggle}
          disabled={!ready}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: playing ? color : "#2a2a35",
            border: "none", cursor: ready ? "pointer" : "default",
            fontSize: 12, display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
            color: playing ? "#000" : "#ccc",
            transition: "background 0.15s",
            opacity: ready ? 1 : 0.4,
          }}
        >
          {playing ? "⏸" : "▶"}
        </button>

        {/* Label */}
        <div style={{ width: 76, flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#ddd" }}>
            {STEM_ICONS[stem]} {STEM_LABELS[stem]}
          </span>
        </div>

        {/* Waveform */}
        <div ref={containerRef} style={{ flex: 1, minWidth: 0 }} />

        {/* Time */}
        <div style={{ fontSize: 11, color: "#555", flexShrink: 0, width: 70, textAlign: "right" }}>
          {fmt(currentTime)} / {fmt(duration)}
        </div>

        {/* Download */}
        <a
          href={url}
          download
          style={{
            padding: "5px 12px", background: "#2a2a35", color: "#aaa",
            borderRadius: 8, fontSize: 12, textDecoration: "none",
            fontWeight: 500, flexShrink: 0, transition: "background 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#3a3a45")}
          onMouseOut={(e)  => (e.currentTarget.style.background = "#2a2a35")}
        >
          Download
        </a>
      </div>

      {/* Volume row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 48 }}>
        {/* Mute */}
        <button
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 14, padding: 0, color: muted ? "#555" : "#888",
            flexShrink: 0,
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>

        {/* Slider */}
        <input
          type="range"
          min={0} max={1} step={0.01}
          value={muted ? 0 : volume}
          onChange={onVolumeChange}
          style={{
            width: 90, accentColor: color, cursor: "pointer",
            height: 3,
          }}
        />
        <span style={{ fontSize: 11, color: "#555", width: 30 }}>
          {Math.round((muted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
}

export default function JobStatus({ jobId, filename, onComplete }) {
  const [job, setJob] = useState({ status: "pending", progress: 0, stems: [] });
  const intervalRef = useRef(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        setJob(data);
        if (data.status === "done" || data.status === "error") {
          clearInterval(intervalRef.current);
          if (data.status === "done" && !notifiedRef.current) {
            notifiedRef.current = true;
            onComplete?.({
              jobId,
              filename,
              stems: data.stems,
              model: data.model,
              format: data.output_format,
              trackName: data.filename?.replace(/\.[^.]+$/, "") ?? jobId,
              completedAt: new Date().toISOString(),
            });
          }
        }
      } catch { /* ignore transient errors */ }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, [jobId]);

  const statusColor = {
    pending: "#888", processing: "#f59e0b", done: "#34d399", error: "#f87171",
  }[job.status] ?? "#888";

  const isDone = job.status === "done";

  return (
    <div style={{
      background: "#14141a", border: "1px solid #222228",
      borderRadius: 16, padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: isDone ? 16 : 0 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: "#ddd", wordBreak: "break-all" }}>
            {filename}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            {job.status === "processing" && <Spinner />}
            <span style={{ fontSize: 13, color: statusColor }}>
              {job.status === "processing"
                ? `Splitting stems… ${job.progress > 0 ? `${job.progress}%` : ""}`
                : job.status === "pending" ? "Queued…"
                : job.status === "done"    ? "Done"
                : "Failed"}
            </span>
          </div>

          {/* Progress bar */}
          {job.status === "processing" && (
            <div style={{
              marginTop: 8, height: 3, borderRadius: 2,
              background: "#2a2a38", overflow: "hidden", width: "100%",
            }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: "#f59e0b",
                width: `${job.progress}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
          )}
        </div>

        {/* Download all */}
        {isDone && (
          <a
            href={`/api/stems/${jobId}/zip`}
            download
            style={{
              padding: "7px 14px", background: "#2a2a35", color: "#ccc",
              borderRadius: 8, fontSize: 13, textDecoration: "none",
              fontWeight: 500, flexShrink: 0, transition: "background 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#3a3a45")}
            onMouseOut={(e)  => (e.currentTarget.style.background = "#2a2a35")}
          >
            Download All
          </a>
        )}
      </div>

      {/* Error */}
      {job.status === "error" && job.error && (
        <p style={{
          fontSize: 12, color: "#f87171", background: "#1f1015",
          borderRadius: 8, padding: "10px 14px", marginTop: 12,
        }}>
          {job.error}
        </p>
      )}

      {/* Stem cards */}
      {isDone && job.stems.length > 0 && (
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
      display: "inline-block", width: 10, height: 10,
      border: "2px solid #f59e0b", borderTopColor: "transparent",
      borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
    }} />
  );
}

if (typeof document !== "undefined" && !document.getElementById("spin-style")) {
  const s = document.createElement("style");
  s.id = "spin-style";
  s.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}
