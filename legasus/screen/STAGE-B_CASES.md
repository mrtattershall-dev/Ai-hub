# Stage B — P, R, E, D frozen per case, before diagnosis (2026-09-21)

Target `pytorch/pytorch @ 9b6e45278f06`. Cases selected by the frozen rule, in file-path order.
Only each called function was read, as the rule permits.

---

## Case 1 — `gh_summary_path()` @ `.ci/lumen_cli/cli/lib/common/gh_summary.py:55`

    def gh_summary_path() -> Path | None:
        p = os.environ.get("GITHUB_STEP_SUMMARY")
        return Path(p) if p else None

    decision   vllm_build.py:188   if not gh_summary_path(): return       (skip writing a summary)
    P          "writing the step summary will succeed" - what the decision depends on
    R          Path | None
    D          direct inspection of the environment variable AND of the path's writability,
               neither obtained through R
    E          wrong iff the decision takes the P-branch (proceeds to write) while D says the
               write cannot succeed

    state space      UNSET -> None    EMPTY -> None    SET+writable -> Path    SET+unwritable -> Path
    COLLISION        YES - the `Path` class contains SET+writable (P true) and SET+unwritable
                     (P false)

## Case 2 — `local_image_exists()` @ `.ci/lumen_cli/cli/lib/common/docker_helper.py:26`

    empty name -> False;  image present -> True;  NotFound -> False;  APIError -> logs, False

    decision   vllm_build.py:260   if local_image_exists(base_image): return   (skip the build)
    P          "the image exists locally"
    R          bool
    D          direct query of the Docker daemon, not through R
    E          wrong iff the decision takes the ¬P branch (builds) while D says the image exists

    state space      PRESENT -> True   ABSENT -> False   EMPTY-NAME -> False   API-ERROR -> False
    COLLISION        YES - the `False` class contains ABSENT (P false, established) and
                     API-ERROR (P unknown; the image may exist)

## Case 3 — `validate_cuda()` @ `.ci/lumen_cli/cli/lib/core/vllm/vllm_test.py:291`

    def validate_cuda(value: str) -> bool:
        VALID_VALUES = {"8.0", "8.9", "9.0"}
        return all(v in VALID_VALUES for v in value.split())

    decision   vllm_test.py:221   if not validate_cuda(get_env("TORCH_CUDA_ARCH_LIST")):
                                      logger.warning(...)
    P          "the CUDA arch list is specified and valid"
    R          bool
    D          direct inspection of the env string, not through R
    E          wrong iff the decision takes the P-branch (no warning) while D says the list is
               absent or invalid

    state space      ALL-VALID -> True   SOME-INVALID -> False   EMPTY -> all([]) -> True
    COLLISION        YES - the `True` class contains ALL-VALID (P true) and EMPTY (P false)

---

## Predictions

**B1.** All three cases have a collision, so H-INFO predicts wrong entitlement is *possible* in
each. This is a weaker slate than I wanted: the protocol's B2 asked for a paired case with **no**
collision, and the frozen rule's first three do not supply one. **That is recorded, not
repaired** — re-ranking to find a non-colliding case would be selecting after inspection.

**B2 is therefore NOT TESTABLE on this triple.** Reported as such.

**B3.** The four shallower accounts, evaluated in advance:

    output cardinality    all three return 2-3 values; predicts nothing that separates them
    exception handling    predicts case 2 only (APIError); SILENT on cases 1 and 3
    boolean polarity      no inverted-sense predicate here; SILENT on all three
    test structure        not consulted; SILENT

    So cases 1 and 3 are where H-INFO speaks and every shallower account is silent.

**Case 3 is the sharpest**: `all([])` is vacuously `True`, so an EMPTY arch list is reported
valid and the warning is suppressed. H-INFO predicts wrong entitlement; nothing else named
predicts it.

## Executability

Case 2 requires a Docker daemon. If unavailable, it is **UNOBSERVABLE**, not evidence.
