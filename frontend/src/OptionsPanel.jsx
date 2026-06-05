const MODELS = [
  { value: "htdemucs",    label: "htdemucs",    desc: "Balanced — vocals, drums, bass, other" },
  { value: "htdemucs_ft", label: "htdemucs_ft", desc: "Fine-tuned — better vocal separation" },
  { value: "htdemucs_6s", label: "htdemucs_6s", desc: "6-stem — adds piano & guitar" },
];

const FORMATS = [
  { value: "wav",  label: "WAV",  desc: "Lossless, largest file" },
  { value: "flac", label: "FLAC", desc: "Lossless, compressed" },
  { value: "mp3",  label: "MP3",  desc: "Lossy, 320 kbps" },
];

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "#1a1a1f", border: "1px solid #2e2e3a", color: "#ddd",
        borderRadius: 8, padding: "7px 10px", fontSize: 13,
        cursor: "pointer", width: "100%", outline: "none",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: 28,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function TimeInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", background: "#1a1a1f", border: "1px solid #2e2e3a",
          color: "#ddd", borderRadius: 8, padding: "7px 10px",
          fontSize: 13, outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#555")}
        onBlur={(e)  => (e.target.style.borderColor = "#2e2e3a")}
      />
    </div>
  );
}

export default function OptionsPanel({ options, onChange }) {
  const set = (key) => (val) => onChange({ ...options, [key]: val });

  const modelDesc = MODELS.find((m) => m.value === options.model)?.desc ?? "";
  const formatDesc = FORMATS.find((f) => f.value === options.format)?.desc ?? "";

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid #222228",
      borderRadius: 12, padding: "16px 20px",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* Model + Format row */}
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4 }}>
            Model
          </label>
          <Select value={options.model} onChange={set("model")} options={MODELS} />
          <p style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{modelDesc}</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4 }}>
            Output Format
          </label>
          <Select value={options.format} onChange={set("format")} options={FORMATS} />
          <p style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{formatDesc}</p>
        </div>
      </div>

      {/* Trim row */}
      <div>
        <p style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
          Trim <span style={{ color: "#444" }}>(optional — MM:SS or seconds)</span>
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <TimeInput
            label="Start"
            value={options.startTime}
            onChange={set("startTime")}
            placeholder="0:00"
          />
          <TimeInput
            label="End"
            value={options.endTime}
            onChange={set("endTime")}
            placeholder="e.g. 1:30"
          />
        </div>
      </div>
    </div>
  );
}
