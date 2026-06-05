import os
import uuid
import asyncio
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/tmp/stems")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# job_id -> {"status": "pending|processing|done|error", "stems": [...], "error": str}
jobs: dict[str, dict] = {}

STEM_NAMES = ["vocals", "drums", "bass", "other"]


def run_demucs(job_id: str, input_path: Path, output_dir: Path):
    try:
        jobs[job_id]["status"] = "processing"
        result = subprocess.run(
            [
                "python", "-m", "demucs",
                "--name", "htdemucs",
                "--out", str(output_dir),
                str(input_path),
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = result.stderr[-2000:]
            return

        # Demucs outputs to output_dir/htdemucs/<track_name>/<stem>.wav
        track_name = input_path.stem
        stem_dir = output_dir / "htdemucs" / track_name
        stems = []
        for stem in STEM_NAMES:
            stem_file = stem_dir / f"{stem}.wav"
            if stem_file.exists():
                stems.append(stem)

        jobs[job_id]["status"] = "done"
        jobs[job_id]["stems"] = stems
        jobs[job_id]["track_name"] = track_name
        jobs[job_id]["stem_dir"] = str(stem_dir)
    except subprocess.TimeoutExpired:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = "Processing timed out after 10 minutes."
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
    finally:
        if input_path.exists():
            input_path.unlink()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/split")
async def split(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    allowed = {".mp3", ".wav", ".flac", ".aiff", ".m4a", ".ogg"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True)

    input_path = job_dir / f"input{ext}"
    content = await file.read()
    input_path.write_bytes(content)

    jobs[job_id] = {"status": "pending", "stems": [], "filename": file.filename}
    background_tasks.add_task(run_demucs, job_id, input_path, job_dir)

    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "status": job["status"],
        "stems": job.get("stems", []),
        "filename": job.get("filename", ""),
        "error": job.get("error"),
    }


@app.get("/api/stems/{job_id}/{stem}")
def download_stem(job_id: str, stem: str):
    job = jobs.get(job_id)
    if not job or job["status"] != "done":
        raise HTTPException(404, "Stem not available")
    if stem not in STEM_NAMES:
        raise HTTPException(400, "Invalid stem name")

    stem_path = Path(job["stem_dir"]) / f"{stem}.wav"
    if not stem_path.exists():
        raise HTTPException(404, "Stem file not found")

    track_name = job.get("track_name", "track")
    return FileResponse(
        stem_path,
        media_type="audio/wav",
        filename=f"{track_name}_{stem}.wav",
    )


# Serve React frontend — must come last
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
