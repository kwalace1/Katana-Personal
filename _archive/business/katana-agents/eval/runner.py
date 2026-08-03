# -*- coding: utf-8 -*-
"""Katana agent eval runner.

Loads golden datasets, drives each case against the live agents, scores answers
with deterministic assertions + an LLM rubric judge, and reports per-agent and
overall pass rates. Supports saving a baseline and gating on regressions -- this
is the loop you run before and after any prompt/model change.

Usage:
  python runner.py                          # run every dataset
  python runner.py --agent "Inventory Agent"
  python runner.py --suite data             # only cases of type 'data'
  python runner.py --limit 3                # first 3 cases per agent
  python runner.py --no-judge               # deterministic checks only
  python runner.py --dry-run                # validate datasets + ground truth, don't drive agents
  python runner.py --baseline               # save this run as the baseline
  python runner.py --gate                   # compare to baseline, exit 1 on regression
"""
import argparse
import glob
import io
import json
import os
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import yaml  # noqa: E402

import config as C  # noqa: E402
import engine  # noqa: E402
import scorers  # noqa: E402

try:
    import judge as judge_mod
except Exception:  # noqa: BLE001
    judge_mod = None

HERE = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(HERE, "datasets")
RESULTS_DIR = os.path.join(HERE, "results")
BASELINE_PATH = os.path.join(RESULTS_DIR, "baseline.json")


def load_datasets(agent_filter=None):
    files = sorted(glob.glob(os.path.join(DATASETS_DIR, "*.yaml")))
    datasets = []
    for f in files:
        with open(f, encoding="utf-8") as fh:
            doc = yaml.safe_load(fh)
        if not doc:
            continue
        if agent_filter and doc.get("agent") != agent_filter:
            continue
        doc["_file"] = os.path.basename(f)
        datasets.append(doc)
    return datasets


def ground_truth_for(case):
    """Return (row, error) for a case's ground_truth_sql, or (None, None)."""
    sql = case.get("ground_truth_sql")
    if not sql:
        return None, None
    from ground_truth import query, GroundTruthError
    try:
        rows = query(sql)
        return (rows[0] if rows else {}), None
    except GroundTruthError as e:
        return None, str(e)


def score_case(case, result, gt_row, use_judge):
    checks = scorers.run_assertions(case, result, gt_row)
    det_pass = all(c["passed"] for c in checks)

    judge_res = None
    judge_pass = True
    jc = case.get("judge")
    if use_judge and jc and judge_mod and result.answer:
        try:
            judge_res = judge_mod.grade(case["question"], result.answer, jc.get("rubric", ""))
            judge_pass = judge_res["score"] >= int(jc.get("min_score", 70))
        except Exception as e:  # noqa: BLE001
            judge_res = {"score": None, "reasons": f"judge error: {e}"}
            judge_pass = True  # don't fail a case on judge transport error

    passed = bool(result.ok) and det_pass and judge_pass
    return {
        "id": case.get("id"),
        "type": case.get("type"),
        "question": case.get("question"),
        "passed": passed,
        "answer_ok": bool(result.ok),
        "error": result.error,
        "checks": checks,
        "judge": judge_res,
        "delegated_to": result.delegated_names,
        "used_sql": result.used_sql,
        "latency_ms": result.latency_ms,
        "answer_preview": (result.answer or "")[:280],
    }


def run(args):
    datasets = load_datasets(args.agent)
    if not datasets:
        raise SystemExit("No datasets matched.")

    C.sanity_check(
        need_judge=not args.no_judge and not args.dry_run,
        need_ground_truth=any(c.get("ground_truth_sql") for d in datasets for c in d.get("cases", [])),
        need_drive=not args.dry_run,
    )

    overall = []
    per_agent = {}
    print(f"Target: {C.TARGET}  |  judge: {'off' if args.no_judge else C.JUDGE_MODEL}  |  "
          f"{'DRY RUN' if args.dry_run else 'live'}\n")

    for doc in datasets:
        agent = doc["agent"]
        agent_id = doc.get("agent_id") or C.AGENTS.get(agent)
        cases = doc.get("cases", [])
        if args.suite:
            cases = [c for c in cases if c.get("type") == args.suite]
        if args.limit:
            cases = cases[: args.limit]
        if not cases:
            continue
        print(f"=== {agent} ({len(cases)} cases) ===")
        results = []
        for case in cases:
            gt_row, gt_err = ground_truth_for(case)
            if args.dry_run:
                status = "GT-ERR" if gt_err else ("GT-ok" if case.get("ground_truth_sql") else "no-GT")
                print(f"  [{status:6}] {case.get('id')}  {gt_err or (json.dumps(gt_row) if gt_row else '')}")
                continue
            result = engine.run_case(agent_id, case["question"])
            scored = score_case(case, result, gt_row, use_judge=not args.no_judge)
            scored["ground_truth"] = gt_row
            scored["ground_truth_error"] = gt_err
            results.append(scored)
            mark = "PASS" if scored["passed"] else "FAIL"
            js = f" judge={scored['judge']['score']}" if scored.get("judge") and scored["judge"].get("score") is not None else ""
            print(f"  [{mark}] {case.get('id'):32} {scored['latency_ms']:>6}ms{js}"
                  + ("" if scored["passed"] else f"  <- {_fail_reason(scored)}"))
            overall.append(scored)
            per_agent.setdefault(agent, []).append(scored)
            time.sleep(args.sleep)
        print()

    if args.dry_run:
        print("Dry run complete (datasets + ground truth validated).")
        return

    _report(overall, per_agent, args)


def _fail_reason(scored):
    if not scored["answer_ok"]:
        return f"no answer ({scored['error']})"
    bad = [c["check"] + ":" + c["detail"] for c in scored["checks"] if not c["passed"]]
    if scored.get("judge") and scored["judge"].get("score") is not None:
        jc = scored["judge"]
        if not bad or jc["score"] < 70:
            bad.append(f"judge={jc['score']} ({jc['reasons'][:80]})")
    return "; ".join(bad) or "judge below threshold"


def _report(overall, per_agent, args):
    total = len(overall)
    passed = sum(1 for r in overall if r["passed"])
    print("──────────────────────────────────────────────")
    print(f"OVERALL: {passed}/{total} passed ({(100*passed/total if total else 0):.0f}%)")
    summary = {}
    for agent, rs in per_agent.items():
        p = sum(1 for r in rs if r["passed"])
        summary[agent] = {"passed": p, "total": len(rs), "rate": round(100 * p / len(rs), 1)}
        print(f"  {agent:18} {p}/{len(rs)}  ({summary[agent]['rate']:.0f}%)")

    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    run_obj = {
        "stamp": stamp, "target": C.TARGET, "judge_model": None if args.no_judge else C.JUDGE_MODEL,
        "overall": {"passed": passed, "total": total},
        "per_agent": summary,
        "cases": {r["id"]: {"passed": r["passed"], "judge": (r["judge"] or {}).get("score")} for r in overall},
        "detail": overall,
    }
    out_path = os.path.join(RESULTS_DIR, f"run-{stamp}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(run_obj, f, indent=2)
    print(f"\nWrote {out_path}")

    if args.baseline:
        with open(BASELINE_PATH, "w", encoding="utf-8") as f:
            json.dump(run_obj, f, indent=2)
        print(f"Saved baseline -> {BASELINE_PATH}")

    if args.gate:
        _gate(run_obj)


def _gate(run_obj):
    if not os.path.exists(BASELINE_PATH):
        print("\nGATE: no baseline to compare against (run --baseline first).")
        return
    with open(BASELINE_PATH, encoding="utf-8") as f:
        base = json.load(f)
    regressions = []
    for cid, cur in run_obj["cases"].items():
        prev = base["cases"].get(cid)
        if prev and prev["passed"] and not cur["passed"]:
            regressions.append(cid)
    print("\n── GATE ──")
    if regressions:
        print(f"REGRESSED ({len(regressions)}): " + ", ".join(regressions))
        sys.exit(1)
    print("No regressions vs baseline. OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent")
    ap.add_argument("--suite", help="filter by case type: data|feature|routing|refusal|hygiene")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--no-judge", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--baseline", action="store_true")
    ap.add_argument("--gate", action="store_true")
    ap.add_argument("--sleep", type=float, default=1.0, help="seconds between cases (rate-limit safety)")
    run(ap.parse_args())


if __name__ == "__main__":
    main()
