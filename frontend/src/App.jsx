import { useState, useCallback } from "react";
import Dropzone from "./Dropzone.jsx";
import TrimmerPanel from "./TrimmerPanel.jsx";
import JobStatus from "./JobStatus.jsx";

export default function App() {
  const [pendingFile, setPendingFile] = useState(null);
  const [jobs, setJobs] = useState([]);

  const addJob = useCallback((jobId, filename) => {
    setJobs((prev) => [{ jobId, filename, key: jobId }, ...prev]);
  }, []);

  const handleSubmit = useCallback(async ({ file, model, format, startTime, endTime }) => {
    setPendingFile(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("model", model);
      form.append("output_format", format);
      form.append("start_time", startTime ?? "");
      form.append("end_time", endTime ?? "");

      const res = await fetch("/api/split", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed (${res.status})`);
      }
      const { job_id } = await res.json();
      addJob(job_id, file.name);
    } catch (e) {
      alert(e.message);
    }
  }, [addJob]);

  return (
    <div style={{ width: "100%", maxWidth: 720 }}>
      <header style={{ marginBottom: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" }}>
          Stem Splitter
        </h1>
        <p style={{ marginTop: 8, color: "#888", fontSize: 15 }}>
          Isolate vocals, drums, bass, and more from any audio file
        </p>
      </header>

      {pendingFile ? (
        <TrimmerPanel
          file={pendingFile}
          onSubmit={handleSubmit}
          onCancel={() => setPendingFile(null)}
        />
      ) : (
        <Dropzone onFilePicked={setPendingFile} />
      )}

      {jobs.length > 0 && (
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          {jobs.map((j) => (
            <JobStatus key={j.key} jobId={j.jobId} filename={j.filename} />
          ))}
        </div>
      )}
    </div>
  );
}
