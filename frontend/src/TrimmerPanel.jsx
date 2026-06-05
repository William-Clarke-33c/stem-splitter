import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

const MODELS = [
  { value: "htdemucs",    label: "htdemucs",    desc: "Balanced — vocals, drums, bass, other" },
  { value: "htdemucs_ft", label: "htdemucs_ft", desc: "Fine-tuned — better vocal separation" },
  { value: "htdemucs_6s", label: "htdemucs_6s", desc: "6-stem — adds piano & guitar" },
];

const FORMATS = [
  { value: "wav",  label: "WAV",  desc: "Lossless" },
  { value: "flac", label: "FLAC", desc: "Lossless compressed" },
  { value: "mp3",  label: "MP3",  desc: "320 kbps" },
];

function fmt(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function TrimmerPanel({ file, onSubmit, onCancel }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const regionRef = useRef(null);
  const objUrlRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [model, setModel] = useState("htdemucs");
  const [format, setFormat] = useState("wav");

  useEffect(() => {
    if (!containerRef.current || !file) return;

    const url = URL.createObjectURL(file);
    objUrlRef.current = url;

    const wsRegions = RegionsPlugin.create();

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#2e2e3e",
      progressColor: "#7c6ff7",
      url,
      height: 72,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
      plugins: [wsRegions],
    });

    ws.on("ready", (d) => {
      setDuration(d);
      setStart(0);
      setEnd(d);
      setReady(true);

      const region = wsRegions.addRegion({
        start: 0,
        end: d,
        color: "rgba(124, 111, 247, 0.18)",
        drag: true,
        resize: true,
      });
      regionRef.current = region;

      wsRegions.on("region-updated", (r) => {
        setStart(r.start);
        setEnd(r.end);
      });
    });

    ws.on("play",   () => setPlaying(true));
    ws.on("pause",  () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));

    wsRef.current = ws;

    return () => {
      ws.destroy();
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const toggle = () => {
    const ws = wsRef.current;
    if (!ws || !ready) return;
    if (playing) {
      ws.pause();
    } else {
      // Play just the selected region
      ws.play(start, end);
    }
  };

  const isFullTrack = start < 0.1 && Math.abs(end - duration) < 0.1;

  const handleSubmit = () => {
    onSubmit({
      file,
      model,
      format,
      startTime: isFullTrack ? "" : String(Math.round(start)),
      endTime:   isFullTrack ? "" : String(Math.round(end)),
    });
  };

  const modelDesc = MODELS.find((m) => m.value === model)?.desc ?? "";

  return (
    <div style={{
      background: "#14141a",
      border: "1px solid #222228",
      borderRadius: 16,
      padding: 24,
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* File name + cancel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 15, color: "#ddd" }}>{file.name}</p>
          <p style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
            {ready ? `${fmt(duration)} total` : "Loading waveform…"}
          </p>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: "none", border: "none", color: "#555",
            cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Waveform */}
      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ borderRadius: 8, overflow: "hidden" }} />
        {!ready && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#1a1a22", borderRadius: 8,
            fontSize: 13, color: "#555",
          }}>
            Loading…
          </div>
        )}
      </div>

      {/* Trim info + play */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={toggle}
          disabled={!ready}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: playing ? "#7c6ff7" : "#2a2a35",
            border: "none", cursor: ready ? "pointer" : "default",
            fontSize: 12, color: playing ? "#fff" : "#ccc",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, opacity: ready ? 1 : 0.4,
            transition: "background 0.15s",
          }}
        >
          {playing ? "⏸" : "▶"}
        </button>

        <div style={{
          flex: 1,
          background: "#1a1a22",
          borderRadius: 8,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
        }}>
          <span style={{ color: "#7c6ff7", fontVariantNumeric: "tabular-nums" }}>{fmt(start)}</span>
          <div style={{ flex: 1, height: 1, background: "#7c6ff7", opacity: 0.4 }} />
          <span style={{ color: "#7c6ff7", fontVariantNumeric: "tabular-nums" }}>{fmt(end)}</span>
        </div>

        <span style={{ fontSize: 12, color: "#555", flexShrink: 0 }}>
          {isFullTrack ? "Full track" : `${fmt(end - start)} selected`}
        </span>
      </div>

      {/* Options row */}
      <div style={{ display: "flex", gap: 12 }}>
        {/* Model */}
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 4 }}>Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={selectStyle}
          >
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <p style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{modelDesc}</p>
        </div>
        {/* Format */}
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 4 }}>Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            style={selectStyle}
          >
            {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>)}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={secondaryBtn}>Cancel</button>
        <button onClick={handleSubmit} disabled={!ready} style={{ ...primaryBtn, opacity: ready ? 1 : 0.5 }}>
          Split Stems
        </button>
      </div>
    </div>
  );
}

const selectStyle = {
  width: "100%",
  background: "#1a1a1f",
  border: "1px solid #2e2e3a",
  color: "#ddd",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  cursor: "pointer",
  outline: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 28,
};

const primaryBtn = {
  padding: "9px 22px",
  background: "#7c6ff7",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "9px 22px",
  background: "#2a2a35",
  color: "#aaa",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};
