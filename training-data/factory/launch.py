"""
launch.py - start a long Modal job that CANNOT be killed by this machine.

    python factory/launch.py evalset --ref unsloth/Qwen2.5-Coder-32B-Instruct-bnb-4bit --out eval_32b.jsonl
    python factory/launch.py train   --run-name run7 --epochs 1
    python factory/launch.py status                       # what is running right now

WHY THIS EXISTS
---------------
`modal run --detach` still dies when its LOCAL client process dies. Measured on
2026-09-09, three separate GPU runs were lost this way:

    run6 training      killed at step 306    a watcher script tore down the client
    32B eval (A100)    killed during load    a shell command killed the process tree
    32B eval (H100)    killed at 2/75        "[Errno 11001] getaddrinfo failed" - a DNS blip

Every one logged "Received a cancellation signal", and every one cost real money for no
result. The lesson is that with `modal run`, the client is a single point of failure for
a job that may run for hours - a laptop closing its lid can end a training run.

`modal deploy` + `Function.spawn()` does not have that property. Deploy registers the app
server-side; spawn queues the call and returns a handle IMMEDIATELY. The job then runs to
completion inside Modal whether or not this machine is awake, connected, or alive.

The trade is one extra step (deploy before spawn) and losing streamed logs, which is a
good trade for anything longer than a couple of minutes. Logs are still there via
`modal app logs`.
"""
import subprocess
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))

JOBS = {
    # name -> (file, modal app name, function name)
    "evalset": ("modal_evalset.py", "qwen-evalset", "generate"),
    "evalset-hf": ("modal_evalset.py", "qwen-evalset", "generate_hf"),
    "train": ("modal_train.py", "qwen-train", "train"),
    "repair": ("modal_repair.py", "qwen-repair", "repair"),
}


def sh(args):
    print("  $", " ".join(args), flush=True)
    return subprocess.run(args, cwd=os.path.dirname(HERE)).returncode


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        print("  jobs:", ", ".join(JOBS))
        return 0

    job = sys.argv[1]

    if job == "status":
        return sh([sys.executable, "-m", "modal", "app", "list"])

    if job not in JOBS:
        print(f"unknown job '{job}'. one of: {', '.join(JOBS)}, status")
        return 1

    fname, app_name, fn_name = JOBS[job]
    rel = os.path.join("factory", fname)

    # Parse --key value pairs into kwargs for the remote function.
    kwargs = {}
    rest = sys.argv[2:]
    for i in range(0, len(rest) - 1, 2):
        if rest[i].startswith("--"):
            key = rest[i][2:].replace("-", "_")
            val = rest[i + 1]
            if val.isdigit():
                val = int(val)
            kwargs[key] = val

    # 1. Deploy - registers the app server-side. Safe to repeat; it is idempotent.
    print(f"\n== deploying {rel} ==", flush=True)
    if sh([sys.executable, "-m", "modal", "deploy", rel]) != 0:
        print("deploy failed - not spawning")
        return 1

    # 2. Spawn - queues the call and returns at once. The job now outlives this process.
    print(f"\n== spawning {app_name}.{fn_name}({kwargs}) ==", flush=True)
    import modal
    fn = modal.Function.from_name(app_name, fn_name)
    call = fn.spawn(**kwargs)
    print(f"\n  spawned. call id: {call.object_id}")
    print(f"  this machine can now be closed, disconnected, or crash - the job continues.")
    print(f"\n  watch:   python -m modal app logs {app_name}")
    print(f"  status:  python factory/launch.py status")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
