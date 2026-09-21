"""Stage B diagnosis - run the three frozen cases against the INDEPENDENT entitlement criterion.

    python legasus/screen/stageb_diagnose.py <target-root> <out-dir>

E (frozen, STAGE-B_PROTOCOL.md): entitlement is WRONG when the downstream decision takes the
P-branch while a DIRECT measurement of the underlying state, obtained WITHOUT passing through R,
says not-P. The direct channel D is named per case in STAGE-B_CASES.md and never reads R.
"""
import ast
import json
import os
import sys
import tempfile


def load_function(path, name):
    """Load ONE function from the sealed source, with no package imports."""
    src = open(path, "r", encoding="utf-8", errors="replace").read()
    tree = ast.parse(src)
    fn = next(n for n in ast.walk(tree)
              if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name)
    mod = ast.Module(body=[fn], type_ignores=[])
    ns = {}
    exec(compile(ast.fix_missing_locations(mod), path, "exec"), ns)  # noqa: S102 - sealed source
    return ns[name]


def main():
    root, out_dir = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)
    results = {}

    # ---- Case 1: gh_summary_path -------------------------------------------------------------
    p1 = os.path.join(root, ".ci", "lumen_cli", "cli", "lib", "common", "gh_summary.py")
    ns = {"os": os}
    exec(compile("from pathlib import Path", "<h>", "exec"), ns)  # noqa: S102
    src = open(p1, encoding="utf-8", errors="replace").read()
    fn_src = ast.get_source_segment(src, next(n for n in ast.walk(ast.parse(src))
                                              if isinstance(n, ast.FunctionDef) and n.name == "gh_summary_path"))
    exec(compile(fn_src, p1, "exec"), ns)  # noqa: S102 - sealed source, one function
    gh_summary_path = ns["gh_summary_path"]

    c1 = {}
    tmpdir = tempfile.mkdtemp()
    writable = os.path.join(tmpdir, "summary.md")
    unwritable = os.path.join(tmpdir, "no-such-dir", "summary.md")   # parent does not exist
    for state, env in (("UNSET", None), ("EMPTY", ""), ("SET_writable", writable), ("SET_unwritable", unwritable)):
        if env is None:
            os.environ.pop("GITHUB_STEP_SUMMARY", None)
        else:
            os.environ["GITHUB_STEP_SUMMARY"] = env
        r = gh_summary_path()                       # the representation
        decision_takes_P_branch = bool(r)           # `if not gh_summary_path(): return`
        # D - direct channel: can the write actually succeed? Never consults r.
        if env:
            try:
                with open(env, "a", encoding="utf-8"):
                    pass
                d_says_P = True
            except Exception:  # noqa: BLE001
                d_says_P = False
        else:
            d_says_P = False
        c1[state] = {"R": str(r), "decision_proceeds": decision_takes_P_branch,
                     "D_says_P": d_says_P, "entitlement_wrong": decision_takes_P_branch and not d_says_P}
    os.environ.pop("GITHUB_STEP_SUMMARY", None)
    results["case1_gh_summary_path"] = {"states": c1,
                                        "wrong_entitlement": any(v["entitlement_wrong"] for v in c1.values())}

    # ---- Case 2: local_image_exists ----------------------------------------------------------
    try:
        import docker  # noqa: F401
        results["case2_local_image_exists"] = {"verdict": "NOT RUN - docker present but a live daemon "
                                                          "would be required; not attempted"}
    except ImportError:
        results["case2_local_image_exists"] = {"verdict": "UNOBSERVABLE", "reason": "the docker package is "
                                               "not installed, so the direct channel D cannot be opened"}

    # ---- Case 3: validate_cuda ---------------------------------------------------------------
    p3 = os.path.join(root, ".ci", "lumen_cli", "cli", "lib", "core", "vllm", "vllm_test.py")
    validate_cuda = load_function(p3, "validate_cuda")
    c3 = {}
    for state, value in (("ALL_VALID", "8.0 9.0"), ("SOME_INVALID", "8.0 7.5"), ("EMPTY", ""),
                         ("WHITESPACE", "   ")):
        r = validate_cuda(value)                    # the representation
        decision_takes_P_branch = bool(r)           # `if not validate_cuda(...): warn`
        # D - direct channel: inspect the string itself, never r.
        tokens = value.split()
        d_says_P = len(tokens) > 0 and all(t in {"8.0", "8.9", "9.0"} for t in tokens)
        c3[state] = {"R": r, "decision_suppresses_warning": decision_takes_P_branch,
                     "D_says_P": d_says_P, "entitlement_wrong": decision_takes_P_branch and not d_says_P}
    results["case3_validate_cuda"] = {"states": c3,
                                      "wrong_entitlement": any(v["entitlement_wrong"] for v in c3.values())}

    json.dump(results, open(os.path.join(out_dir, "stageb_diagnosis.json"), "w"), indent=2)
    for case, r in results.items():
        print(f"== {case}")
        if "states" not in r:
            print(f"   {r['verdict']}: {r.get('reason', '')}")
            continue
        for st, v in r["states"].items():
            flag = "  <<< WRONG ENTITLEMENT" if v["entitlement_wrong"] else ""
            print(f"   {st:16} R={str(v['R']):10} D_says_P={str(v['D_says_P']):5}{flag}")
        print(f"   wrong entitlement observed: {r['wrong_entitlement']}")
    print(f"-> {os.path.join(out_dir, 'stageb_diagnosis.json')}")


if __name__ == "__main__":
    main()
