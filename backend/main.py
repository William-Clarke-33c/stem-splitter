import io
import os
import re
import time
import uuid
import queue
import shutil
import zipfile
import threading
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import subprocess

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/tmp/stems")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ── In-memory state ──────────────────────────────────────────────────────────
jobs: dict[str, dict] = {}
job_queue: queue.Queue = queue.Queue()
waiting: list[str] = []       # job_ids waiting in order
waiting_lock = threading.Lock()

ALL_STEMS    = ["vocals", "drums", "bass", "other", "piano", "guitar"]
VALID_MODELS  = {"htdemucs", "htdemucs_ft", "htdemucs_6s"}
VALID_FORMATS = {"wav", "mp3", "flac"}


# ── Password auth ────────────────────────────────────────────────────────────
def require_auth(x_access_password: str = Header(default="")):
    pw = os.environ.get("ACCESS_PASSWORD", "")
    if pw and x_access_password != pw:
        raise HTTPException(401, "Invalid password")


# ── Helpers ──────────────────────────────────────────────────────────────────
def parse_time(value: str) -> Optional[float]:
    if not value or not value.strip():
        return None
    value = value.strip()
    if ":" in value:
        parts = value.split(":")
        try:
            return int(parts[0]) * 60 + float(parts[1])
        except (ValueError, IndexError):
            return None
    try:
        return float(value)
    except ValueError:
        return None


def trim_audio(input_path: Path, start: Optional[float], end: Optional[float]) -> Path:
    if start is None and end is None:
        return input_path
    args = ["ffmpeg", "-y", "-i", str(input_path)]
    if start is not None:
        args += ["-ss", str(start)]
    if end is not None:
        args += ["-to", str(end)]
    args += ["-c", "copy"]
    trimmed_path = input_path.parent / f"trimmed{input_path.suffix}"
    args.append(str(trimmed_path))
    result = subprocess.run(args, capture_output=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg trim failed: {result.stderr.decode()[-1000:]}")
    input_path.unlink()
    return trimmed_path


# ── Demucs runner ─────────────────────────────────────────────────────────────
def run_demucs(
    job_id: str,
    input_path: Path,
    output_dir: Path,
    model: str,
    output_format: str,
    start_time: Optional[float],
    end_time: Optional[float],
    requested_stems: Optional[list],
):
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["progress"] = 0

        if start_time is not None or end_time is not None:
            input_path = trim_audio(input_path, start_time, end_time)

        cmd = ["python", "-m", "demucs", "--name", model, "--out", str(output_dir)]
        if output_format == "mp3":
            cmd += ["--mp3", "--mp3-bitrate", "320"]
        elif output_format == "flac":
            cmd.append("--flac")
        # Single-stem mode is significantly faster — Demucs skips separating the rest
        if requested_stems and len(requested_stems) == 1:
            cmd += ["--two-stems", requested_stems[0]]
        cmd.append(str(input_path))

        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        output_lines = []
        for line in proc.stdout:
            output_lines.append(line)
            m = re.search(r"(\d+)%\|", line)
            if m:
                jobs[job_id]["progress"] = int(m.group(1))

        proc.wait(timeout=600)

        if proc.returncode != 0:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = "".join(output_lines)[-2000:]
            return

        ext = {"mp3": ".mp3", "flac": ".flac"}.get(output_format, ".wav")
        track_name = input_path.stem
        stem_dir = output_dir / model / track_name
        stems = [
            s for s in ALL_STEMS
            if (stem_dir / f"{s}{ext}").exists()
            and (requested_stems is None or s in requested_stems)
        ]

        jobs[job_id].update({
            "status": "done",
            "progress": 100,
            "stems": stems,
            "track_name": track_name,
            "stem_dir": str(stem_dir),
            "ext": ext,
            "completed_at": time.time(),
        })
    except subprocess.TimeoutExpired:
        proc.kill()
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = "Processing timed out after 10 minutes."
        jobs[job_id]["completed_at"] = time.time()
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["completed_at"] = time.time()
    finally:
        if input_path.exists():
            input_path.unlink()


# ── Queue worker (single thread — one job at a time) ─────────────────────────
def queue_worker():
    while True:
        job_id, args = job_queue.get()
        with waiting_lock:
            if job_id in waiting:
                waiting.remove(job_id)
        try:
            if job_id in jobs:
                run_demucs(job_id, *args)
        finally:
            job_queue.task_done()


threading.Thread(target=queue_worker, daemon=True).start()


# ── Cleanup worker (runs every hour, removes jobs older than 24 h) ───────────
def cleanup_worker():
    while True:
        time.sleep(3600)
        cutoff = time.time() - 86400
        for job_id in list(jobs.keys()):
            job = jobs[job_id]
            completed = job.get("completed_at")
            if completed and completed < cutoff:
                job_dir = job.get("job_dir")
                if job_dir:
                    shutil.rmtree(job_dir, ignore_errors=True)
                jobs.pop(job_id, None)


threading.Thread(target=cleanup_worker, daemon=True).start()


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "ok": True,
        "password_required": bool(os.environ.get("ACCESS_PASSWORD")),
    }


@app.post("/api/split", dependencies=[Depends(require_auth)])
async def split(
    file: UploadFile = File(...),
    model: str = Form("htdemucs"),
    output_format: str = Form("wav"),
    start_time: str = Form(""),
    end_time: str = Form(""),
    stems: str = Form(""),
):
    allowed_ext = {".mp3", ".wav", ".flac", ".aiff", ".m4a", ".ogg"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(400, f"Unsupported file type: {ext}")
    if model not in VALID_MODELS:
        raise HTTPException(400, f"Invalid model: {model}")
    if output_format not in VALID_FORMATS:
        raise HTTPException(400, f"Invalid output format: {output_format}")

    start = parse_time(start_time)
    end = parse_time(end_time)
    requested_stems = [s.strip() for s in stems.split(",") if s.strip()] or None

    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True)

    input_path = job_dir / f"input{ext}"
    input_path.write_bytes(await file.read())

    jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "stems": [],
        "filename": file.filename,
        "model": model,
        "output_format": output_format,
        "requested_stems": requested_stems,
        "job_dir": str(job_dir),
    }

    with waiting_lock:
        waiting.append(job_id)

    job_queue.put((job_id, (input_path, job_dir, model, output_format, start, end, requested_stems)))
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}", dependencies=[Depends(require_auth)])
def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    with waiting_lock:
        queue_position = (waiting.index(job_id) + 1) if job_id in waiting else None

    return {
        "status": job["status"],
        "progress": job.get("progress", 0),
        "stems": job.get("stems", []),
        "filename": job.get("filename", ""),
        "model": job.get("model", "htdemucs"),
        "output_format": job.get("output_format", "wav"),
        "queue_position": queue_position,
        "error": job.get("error"),
    }


@app.get("/api/stems/{job_id}/{stem}", dependencies=[Depends(require_auth)])
def download_stem(job_id: str, stem: str):
    job = jobs.get(job_id)
    if not job or job["status"] != "done":
        raise HTTPException(404, "Stem not available")
    if stem not in ALL_STEMS:
        raise HTTPException(400, "Invalid stem name")

    ext = job.get("ext", ".wav")
    stem_path = Path(job["stem_dir"]) / f"{stem}{ext}"
    if not stem_path.exists():
        raise HTTPException(404, "Stem file not found")

    mime = {"mp3": "audio/mpeg", "flac": "audio/flac"}.get(job.get("output_format", "wav"), "audio/wav")
    track_name = job.get("track_name", "track")
    return FileResponse(stem_path, media_type=mime, filename=f"{track_name}_{stem}{ext}")


@app.get("/api/stems/{job_id}/zip", dependencies=[Depends(require_auth)])
def download_zip(job_id: str):
    job = jobs.get(job_id)
    if not job or job["status"] != "done":
        raise HTTPException(404, "Job not ready")

    ext = job.get("ext", ".wav")
    track_name = job.get("track_name", "stems")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for stem in job.get("stems", []):
            p = Path(job["stem_dir"]) / f"{stem}{ext}"
            if p.exists():
                zf.write(p, f"{track_name}_{stem}{ext}")
    buf.seek(0)

    return StreamingResponse(
        iter([buf.read()]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{track_name}_stems.zip"'},
    )


frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
