"""The checkpointer's entire purpose: a run that survives the process being killed.

Gate 1 is human and asynchronous, so a run has to span days and, in practice, restarts. The
only way to test that honestly is to actually kill a process and continue in a new one, with
nothing shared but Postgres.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import psycopg
import pytest
import yaml

from .conftest import TEST_DATABASE_URL, build_epub

CHILD = Path(__file__).resolve().parent / "_durability_child.py"
PACKAGE_ROOT = Path(__file__).resolve().parent.parent


def _spawn(phase: str, run_id: str, epub: Path, runs_dir: Path) -> subprocess.Popen[str]:
    return subprocess.Popen(
        [sys.executable, str(CHILD), phase, TEST_DATABASE_URL, run_id, str(epub), str(runs_dir)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=str(PACKAGE_ROOT),
        env={**os.environ, "PYTHONPATH": str(PACKAGE_ROOT)},
    )


def test_a_killed_run_resumes_from_the_checkpoint(
    tmp_path: Path,
    db_connection: psycopg.Connection[dict[str, object]],
) -> None:
    """Start, reach gate 1, SIGKILL, restart, approve, continue."""
    epub = build_epub(tmp_path / "book.epub")
    runs_dir = tmp_path / "runs"
    run_id = "run-durability"

    # --- phase 1: run until the gate, then die without cleaning up after itself
    first = _spawn("to-gate", run_id, epub, runs_dir)
    deadline = time.monotonic() + 120
    reached_gate = False

    assert first.stdout is not None
    while time.monotonic() < deadline:
        line = first.stdout.readline()
        if not line and first.poll() is not None:
            break
        if line.strip() == "AT_GATE":
            reached_gate = True
            break

    if not reached_gate:
        first.kill()
        pytest.fail(f"the run never reached gate 1:\n{first.stdout.read()}")

    first.send_signal(signal.SIGKILL)
    first.wait(timeout=30)
    assert first.returncode != 0, "the process must have been killed, not exited cleanly"

    # --- the founder edits the plan and approves it, days later
    plan_file = runs_dir / run_id / "leaf-plan.yaml"
    assert plan_file.exists(), "the gate must have written the plan before it was killed"

    body = yaml.safe_load(plan_file.read_text())
    body["leaves"][0]["title"] = "Edited after the process died"
    body["approved"] = True
    plan_file.write_text(yaml.safe_dump(body, sort_keys=False))

    # --- phase 2: a brand new process, sharing only Postgres
    second = _spawn("resume", run_id, epub, runs_dir)
    stdout, _ = second.communicate(timeout=180)

    assert second.returncode == 0, f"resume failed:\n{stdout}"
    assert "APPROVED=True" in stdout
    assert "LEAVES=22" in stdout
    assert "FIRST_TITLE=Edited after the process died" in stdout, (
        "the resumed run must continue with the founder's edit, not the model's original"
    )
    assert "CHUNKS=0" not in stdout, "ingest state must have survived the kill"
