#!/usr/bin/env python3
"""Repository-level entry point for the retrieval ablation runner."""

import runpy
from pathlib import Path


RUNNER = Path(__file__).resolve().parents[1] / "backend" / "python" / "tools" / "run_ablation.py"


if __name__ == "__main__":
    runpy.run_path(str(RUNNER), run_name="__main__")
