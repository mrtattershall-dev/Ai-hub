# 14B rerun — is the hub making the 14B better?

Same model (Qwen2.5-Coder-14B-Instruct-AWQ, A10G), same 40 goals (goals-A/B.json, byte-identical
to measurements/2026-09-10-14b-vs-32b), same harness and scorer. Only the hub differs:

    baseline  main 725bf46  (14B results in ../2026-09-10-14b-vs-32b)
    rerun     main 6854d73  = 725bf46 + three fixes from the head-to-head:
              9afe43a  a reply cut off mid-code-block writes nothing (was: a 0-byte file)
              95428d9  a top-level function declared twice is flagged after the write
              b59a0c4  a failing Python assert shows both sides (LEFT/RIGHT values)

CAVEAT: run-to-run variance on identical prompts is large (the same 10 goals scored 5/10 and
8/10 on two passes tonight). One rerun mixes the fixes' effect with ordinary variance - compare
goal by goal, and credit a fix only where its mechanism visibly fired (e.g. a failing Python
assert that now shows both sides and the model then fixes the RIGHT side).
