import { useState, useRef, useCallback } from "react";
import Dropzone from "./Dropzone.jsx";
import JobStatus from "./JobStatus.jsx";

export default function App() {
  const [jobs, setJobs] = useState([]);

  const addJob = useCallback((jobId, filename) => {
    setJobs((prev) => [{ jobId, filename, key: jobId }, ...prev]);
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 680 }}>
      <header style={{ marginBottom: 40, textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" }}>
          Stem Splitter
        </h1>
        <p style={{ marginTop: 8, color: "#888", fontSize: 15 }}>
          Isolate vocals, drums, bass, and more from any audio file
        </p>
      </header>

      <Dropzone onJobCreated={addJob} />

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
