"""SCREEN-2 target selection - executes the rule frozen in SCREEN-2_SELECTION.md (f364471).

    python legasus/screen/select_target.py <out-dir>

Metadata only. No file content, no issues, no pull requests, no commit bodies are fetched.
"""
import datetime as dt
import hashlib
import json
import os
import sys
import urllib.request

API = "https://api.github.com"
UA = {"User-Agent": "legasus-screen2-selector", "Accept": "application/vnd.github+json"}
LOCAL_REPOS = {"pewdiepie-archdaemon/odysseus"}   # C7: already on this machine / inspected


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    out_dir = os.path.abspath(sys.argv[1])
    os.makedirs(out_dir, exist_ok=True)
    cutoff = (dt.date.today() - dt.timedelta(days=90)).isoformat()
    q = f"language:python pushed:>={cutoff} stars:>=500"
    url = f"{API}/search/repositories?q={urllib.parse.quote(q)}&per_page=100"
    pool = get(url)["items"]

    candidates, rejected = [], []
    for r in pool:
        full = r["full_name"]
        vals = {
            "C1_language_python": r.get("language") == "Python",
            "C2_pushed_90d": r["pushed_at"][:10] >= cutoff,
            "C3_not_fork_has_licence": (not r["fork"]) and bool(r.get("license")),
            "C4_size_kb_ge_200": r["size"] >= 200,
            "C7_fresh": full.lower() not in LOCAL_REPOS,
        }
        if not all(vals.values()):
            rejected.append({"repo": full, "failed": [k for k, v in vals.items() if not v]})
            continue
        candidates.append({"repo": full, "size_kb": r["size"], "pushed": r["pushed_at"],
                           "default_branch": r["default_branch"], "html_url": r["html_url"], "criteria": vals})

    # C5 (contributors) and C6 (a tests/ directory, NAMES ONLY) need one call each. Evaluate in
    # the pool's own order until the first 12 survivors are known, to stay inside the
    # unauthenticated rate limit; the deterministic hash rule then picks among them.
    survivors = []
    for c in candidates:
        if len(survivors) >= 12:
            break
        try:
            contribs = get(f"{API}/repos/{c['repo']}/contributors?per_page=10&anon=1")
            c["contributors_at_least"] = len(contribs)
            c["criteria"]["C5_contributors_ge_10"] = len(contribs) >= 10
            tree = get(f"{API}/repos/{c['repo']}/contents/")
            names = [e["name"] for e in tree if e["type"] == "dir"]
            c["top_level_dirs"] = names
            c["criteria"]["C6_has_tests_dir"] = any(n in ("tests", "test") for n in names)
        except Exception as e:  # noqa: BLE001 - a failed lookup is an OBSERVATION, not a pass
            c["lookup_error"] = str(e)[:160]
            c["criteria"]["C5_contributors_ge_10"] = None
            c["criteria"]["C6_has_tests_dir"] = None
        if c["criteria"].get("C5_contributors_ge_10") and c["criteria"].get("C6_has_tests_dir"):
            survivors.append(c)
        else:
            rejected.append({"repo": c["repo"], "failed": [k for k, v in c["criteria"].items() if not v]})

    if not survivors:
        print("NO QUALIFYING CANDIDATE - selection fails rather than relaxing a criterion")
        json.dump({"pool": len(pool), "survivors": [], "rejected": rejected},
                  open(os.path.join(out_dir, "selection.json"), "w"), indent=2)
        return

    for s in survivors:
        s["digest"] = hashlib.sha256(s["repo"].encode()).hexdigest()
    survivors.sort(key=lambda s: s["digest"])
    chosen = survivors[0]

    # Freeze the exact commit SHA. Metadata only.
    head = get(f"{API}/repos/{chosen['repo']}/commits/{chosen['default_branch']}")
    chosen["commit_sha"] = head["sha"]
    chosen["commit_date"] = head["commit"]["committer"]["date"]

    result = {
        "selectedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "query": q,
        "poolSize": len(pool),
        "rule": "lexicographically smallest SHA-256 of owner/name among survivors",
        "detectorStateAtSelection": "SCREEN-1 detectors only (falsified by CONTROL-1); A2/B2 specified but not written",
        "inspected": "repository metadata and top-level directory NAMES only",
        "notInspected": "file content, issues, pull requests, commit bodies, releases",
        "cUnestablished": "nontrivial external/system interaction - not determinable from metadata",
        "selected": chosen,
        "survivors": survivors,
        "rejectedCount": len(rejected),
    }
    json.dump(result, open(os.path.join(out_dir, "selection.json"), "w"), indent=2)
    print(f"pool {len(pool)}, survivors {len(survivors)}, rejected {len(rejected)}")
    for s in survivors:
        print(f"  {s['digest'][:12]}  {s['repo']}")
    print(f"\nSELECTED: {chosen['repo']} @ {chosen['commit_sha'][:12]} ({chosen['commit_date']})")
    print(f"  size {chosen['size_kb']} KB, contributors>= {chosen['contributors_at_least']}, dirs {chosen['top_level_dirs'][:8]}")
    print(f"-> {os.path.join(out_dir, 'selection.json')}")


if __name__ == "__main__":
    import urllib.parse  # noqa: E402 - used in main
    main()
