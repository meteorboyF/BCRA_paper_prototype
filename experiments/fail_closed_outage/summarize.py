#!/usr/bin/env python3
import argparse, csv, json, pathlib, statistics, subprocess
from datetime import datetime, timezone

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--pre", type=int, required=True)
ap.add_argument("--outage", type=int, required=True)
ap.add_argument("--post", type=int, required=True)
ap.add_argument("--concurrency", type=int, required=True)
ap.add_argument("--method", required=True)
args = ap.parse_args()

out = pathlib.Path(args.out)
per_second = list(csv.DictReader(open(out / "per_second.csv")))
requests = list(csv.DictReader(open(out / "requests.csv")))
audit = json.load(open(out / "audit_counts.json"))

def rows(phase):
    return [r for r in requests if r["phase"] == phase]

def count(phase, pred):
    return sum(1 for r in rows(phase) if pred(r))

def sum_int(phase, key):
    return sum(int(r[key]) for r in rows(phase))

def git(cmd):
    try:
        return subprocess.check_output(cmd, text=True).strip()
    except Exception:
        return ""

outage_rows = rows("outage")
outage_denials = count("outage", lambda r: r["status_code"] == "503")
summary = {
    "experiment": "fail_closed_fabric_outage",
    "git_commit": git(["git", "rev-parse", "HEAD"]),
    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    "pre_outage_seconds": args.pre,
    "outage_seconds": args.outage,
    "post_recovery_seconds": args.post,
    "concurrency": args.concurrency,
    "fabric_outage_method": args.method,
    "total_requests": len(requests),
    "pre_outage_success": count("pre_outage", lambda r: r["status_code"].startswith("2")),
    "outage_success": count("outage", lambda r: r["status_code"].startswith("2")),
    "outage_http_503": outage_denials,
    "outage_http_403": count("outage", lambda r: r["status_code"] == "403"),
    "outage_other_5xx": count("outage", lambda r: r["status_code"].startswith("5") and r["status_code"] != "503"),
    "outage_unexpected_200": count("outage", lambda r: r["status_code"].startswith("2")),
    "outage_protected_bytes_returned": sum(int(r["bytes_returned"]) for r in outage_rows if r["returned_ciphertext"] == "true" or r["returned_wrapped_key"] == "true" or r["returned_plaintext"] == "true"),
    "post_recovery_success": count("post_recovery", lambda r: r["status_code"].startswith("2")),
    "fabric_outage_access_denied_rows": audit.get("FABRIC_OUTAGE_ACCESS_DENIED", 0),
    "acl_fabric_fallback_rows": audit.get("ACL_FABRIC_FALLBACK", 0),
    "pass_fail_closed": False,
    "notes": [],
}
summary["pass_fail_closed"] = (
    summary["outage_success"] == 0 and
    summary["outage_protected_bytes_returned"] == 0 and
    summary["outage_http_503"] > 0 and
    summary["fabric_outage_access_denied_rows"] >= summary["outage_http_503"] and
    summary["acl_fabric_fallback_rows"] == 0 and
    summary["post_recovery_success"] > 0
)
if summary["fabric_outage_access_denied_rows"] < summary["outage_http_503"]:
    summary["notes"].append("Audit rows are fewer than HTTP 503 responses; inspect async audit or failed audit writes.")
if summary["post_recovery_success"] == 0:
    summary["notes"].append("No post-recovery successes observed; Fabric may not have recovered before workload ended.")

json.dump(summary, open(out / "summary.json", "w"), indent=2)
print(json.dumps(summary, indent=2))
