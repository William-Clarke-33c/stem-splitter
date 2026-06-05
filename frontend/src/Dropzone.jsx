import { useState, useRef, useCallback } from "react";

const ACCEPTED = ".mp3,.wav,.flac,.aiff,.m4a,.ogg";

export default function Dropzone({ onJobCreated }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const upload = useCallback(async (file) => {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/split", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed (${res.status})`);
      }
      const { job_id } = await res.json();
      onJobCreated(job_id, file.name);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }, [onJobCreated]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, [upload]);

  const onFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) upload(file);
    e.target.value = "";
  }, [upload]);

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? "#7c6ff7" : "#333"}`,
        borderRadius: 16,
        padding: "48px 32px",
        textAlign: "center",
        cursor: uploading ? "default" : "pointer",
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
        onChange={onFileChange}
        disabled={uploading}
      />
      <div style={{ fontSize: 40, marginBottom: 12 }}>
        {uploading ? "⏳" : "🎵"}
      </div>
      <p style={{ fontWeight: 600, fontSize: 16, color: "#ddd" }}>
        {uploading ? "Uploading…" : "Drop an audio file here"}
      </p>
      <p style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
        {uploading ? "Please wait" : "or click to browse — MP3, WAV, FLAC, AIFF, M4A, OGG"}
      </p>
      {error && (
        <p style={{ marginTop: 12, color: "#f87171", fontSize: 13 }}>{error}</p>
      )}
    </div>
  );
}
