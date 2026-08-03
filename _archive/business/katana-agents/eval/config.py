# -*- coding: utf-8 -*-
"""Shared configuration for the Katana agent eval harness.

Env is read from the repo's .env / .env.local (no extra tooling needed). The
harness drives real agent chats and scores their answers; nothing here mutates
agent config.

Two drive backends (set EVAL_TARGET):
  - "proxy"  (default): POST through the Vercel office proxy at EVAL_OFFICE_BASE.
             Requires EVAL_KATANA_JWT (a real Katana user session token). The
             engine forwards this JWT to Supabase for ai_query, so DATA answers
             come back correctly RLS-scoped to that user's org -- the only mode
             that can score org-scoped data questions accurately.
  - "engine" (direct): hit the SwarmClaw engine at EVAL_ENGINE_URL with
             EVAL_ENGINE_KEY (x-access-key). No user identity, so org-scoped
             ai_query returns nothing -- use only for feature/routing/hygiene
             cases, not data cases.

Ground truth is computed by calling the same ai_query RPC over Supabase REST
with EVAL_KATANA_JWT, so "expected" is scoped to the same org the agent sees.
"""
import os
import re

# Live agent roster (name -> id), verified against the deployed engine 2026-07-08.
# The Hub routes; the rest are module specialists.
AGENTS = {
    "Hub Agent": "116c3cfa",
    "PM Agent": "7f94d552",
    "Inventory Agent": "09cd8d63",
    "Customer Agent": "15e15dd4",
    "WFM Agent": "00f13875",
    "HR Agent": "e41e7b68",
    "Employee Agent": "7261ba0a",
    "Careers Agent": "007ec8cf",
    "Facilities Agent": "6b00f785",
    "KYI Agent": "9e5b585a",
    "Support Agent": "a02daa66",
    "Finance Agent": "3d0019db",
}
AGENT_ID_TO_NAME = {v: k for k, v in AGENTS.items()}

# Cheapest capable judge; single provider (OpenRouter) for everything.
JUDGE_MODEL = os.environ.get("EVAL_JUDGE_MODEL", "google/gemini-2.5-flash-lite")
OPENROUTER_BASE = "https://openrouter.ai/api/v1"


def _load_dotenv(*paths):
    """Merge simple KEY=VALUE pairs from the given files into os.environ without
    overwriting anything already set in the real environment."""
    for path in paths:
        try:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k and k not in os.environ:
                        os.environ[k] = v
        except OSError:
            continue


_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_load_dotenv(
    os.path.join(_REPO_ROOT, ".env.local"),
    os.path.join(_REPO_ROOT, ".env"),
)


def get(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        raise SystemExit(
            f"Missing required env var {name}. Set it in .env.local or the environment."
        )
    return val


# --- Resolved settings -------------------------------------------------------
TARGET = os.environ.get("EVAL_TARGET", "proxy").lower()
OFFICE_BASE = os.environ.get("EVAL_OFFICE_BASE", "https://katana-vv2.vercel.app/api/office").rstrip("/")
ENGINE_URL = os.environ.get("EVAL_ENGINE_URL", "").rstrip("/")
ENGINE_KEY = os.environ.get("EVAL_ENGINE_KEY", "")
KATANA_JWT = os.environ.get("EVAL_KATANA_JWT", "")

SUPABASE_URL = (os.environ.get("VITE_SUPABASE_URL") or "https://uhvmhzmxsvrkzqqesbli.supabase.co").rstrip("/")
SUPABASE_ANON = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")


def sanity_check(need_judge=True, need_ground_truth=True, need_drive=True):
    """Fail fast with an actionable message rather than deep in a run."""
    problems = []
    if need_drive:
        if TARGET == "proxy" and not KATANA_JWT:
            problems.append(
                "EVAL_TARGET=proxy needs EVAL_KATANA_JWT (grab your session token from the "
                "browser: sessionStorage.getItem('sc_katana_jwt'))."
            )
        if TARGET == "engine" and not (ENGINE_URL and ENGINE_KEY):
            problems.append("EVAL_TARGET=engine needs EVAL_ENGINE_URL and EVAL_ENGINE_KEY.")
    if need_ground_truth and not (SUPABASE_ANON and KATANA_JWT):
        problems.append(
            "Ground-truth checks need VITE_SUPABASE_ANON_KEY and EVAL_KATANA_JWT "
            "(so 'expected' is scoped to the same org the agent sees)."
        )
    if need_judge and not OPENROUTER_KEY:
        problems.append("LLM-judge checks need OPENROUTER_API_KEY.")
    if problems:
        raise SystemExit("Config problems:\n  - " + "\n  - ".join(problems))
