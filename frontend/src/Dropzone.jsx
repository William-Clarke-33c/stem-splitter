import { useState, useRef, useCallback } from "react";

const ACCEPTED = ".mp3,.wav,.flac,.aiff,.m4a,.ogg";

export default function Dropzone({ onFilePicked }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const pick = useCallback((file) => {
    if (file) onFilePicked(file);
  }, [onFilePicked]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  }, [pick]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? "#7c6ff7" : "#333"}`,
        borderRadius: 16,
        padding: "48px 32px",
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        background: dragging ? "rgba(124,111,247,0.07)" : "rgba(255,255,255,0.03)",
        userSelect: "none",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        style={{ display: "none" }}
        onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }}
      />
      <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
      <p style={{ fontWeight: 600, fontSize: 16, color: "#ddd" }}>Drop an audio file here</p>
      <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
        or click to browse — MP3, WAV, FLAC, AIFF, M4A, OGG
      </p>
    </div>
  );
}
