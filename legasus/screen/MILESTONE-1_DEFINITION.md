# MILESTONE-1 — one desktop session builds a playable farming game, survives a restart, adds a feature without breaking the first ones, and avoids a previously encountered mistake

2026-09-26. Direction from tatte: the product is an autonomous software builder that improves
through use. Safeguards serve that experience; they are not the deliverable. This file turns
the milestone into observable checks, maps the five loop pieces onto what exists, and fixes
the order of the local work. **No spend is involved in anything below until a live session is
authorized.**

## The bar, as observable checks

One session on THIS desktop (i3-1315U, 7.6 GB RAM, integrated graphics, no discrete GPU),
started with one request - "Build me a small farming game" - and then left alone except for
one deliberate restart and one follow-up request:

    M1  PLAYABLE     index.html + game code load in headless Chromium (test_web) with no console
                     error; a scripted play of movement, planting, harvesting, inventory and
                     saving passes a check the model did not write (see "Check")
    M2  RESTART      the hub process is killed and restarted on the same workspace; the next run
                     continues from the recorded state: TASKS.md, NOTES.md, LESSONS.jsonl and
                     the git history are read, not rediscovered; no earlier feature regresses
    M3  ADD          a second request ("add a day/night cycle and crop growth over time") lands
                     as a new increment; every M1 check still passes afterwards (protected
                     behaviour = the M1 checks; the same acceptance policy as the campaigns)
    M4  AVOID        a mistake the session met earlier (recorded as a context-keyed lesson)
                     recurs as an OPPORTUNITY in a later increment and is NOT repeated - measured
                     as: the lesson was retrieved in that context, and the tool call that would
                     have repeated it did not happen / the first attempt succeeded
    M5  DESKTOP      measured on this machine during M1-M3: peak RSS of hub + model, model
                     tokens/s, longest UI-thread stall in the hub's own client, wall-clock per
                     increment, and cost ($0 local; the Modal figure if a hosted model is used)

M1-M4 are pass/fail on their checks; M5 is a measurement, reported, with no threshold
pre-committed (the threshold is a product decision once the numbers exist).

## The loop, mapped onto what exists

    piece      what exists today                                       status
    BUILD      the hub's action loop (plan -> tools -> finish), edit/    IMPLEMENTED for single
               write/append/run tools, git checkpoints per edit,         Python modules and small
               test_web (headless Chromium) for web pages                web pages; PROBED for a
                                                                         multi-file JS game only
                                                                         in early runs (set D-K),
                                                                         with a 14B/30B model
    CHECK      independent evaluator in the worker (requested +          IMPLEMENTED for python
               protected checks); automatic diagnostic (graded cases     cases; UNESTABLISHED for
               before the first action and after every edit); the        a browser game - the
               recovery controller (exact rollback, repeat refusal,      diagnostic and evaluator
               bounded retries); acceptance RETAIN/RESTORED             run python cases, not a
                                                                         scripted play of a page
    REMEMBER   NOTES.md (free text, tail injected at start); TASKS.md    IMPLEMENTED as free text;
               ledger; git history; campaign records                     UNESTABLISHED as lessons:
                                                                         no context key, no
                                                                         retrieval by relevance,
                                                                         no evidence of a lesson
                                                                         changing a later action
    IMPROVE    nothing                                                   UNESTABLISHED
    CONTINUE   batch runner picks the next queued task; the controller   IMPLEMENTED for a queue
               decides whether another attempt deserves compute          the operator wrote;
                                                                         UNESTABLISHED for
                                                                         choosing the next
                                                                         increment itself

## What this milestone requires that does not exist

1. **A game check the model did not write** (CHECK for a browser game). A scripted play in
   headless Chromium: load, press keys, observe state (player position, a planted tile, an
   inventory count, a save round-trip). Declared like the QuixBugs cases: a spec the evaluator
   runs; requested = the new increment's checks, protected = every earlier increment's checks.
   The evaluator already runs a script in a read-only worker; it needs a browser-play script
   and a JS-capable image, or test_web extended to run a declared play script. This is the
   first engineering item because M1, M3 and the controller all hang on it.

2. **Context-keyed lessons** (REMEMBER + IMPROVE). `LESSONS.jsonl` in the workspace; a lesson is
   `{ context: { language, tool, phase, errorSignature }, mistake, fix, evidence }`. Two
   producers: the model proposes one with the `lesson` tool; the Hub records one automatically
   when a tool call fails with a signature and a later call on the same file succeeds. Two
   consumers: at run start, lessons whose context matches the project's languages are injected
   (bounded); when a tool call fails with a signature that matches a lesson in the same
   language and tool, the lesson is appended to that error result at that moment. Retrieval is
   by context match, never by recency alone - the backslash rule: "in a bash heredoc feeding
   Python, a doubled backslash collapses" must not become "avoid backslashes". M4 measures it.

3. **Increment selection** (CONTINUE). After an accepted increment, the Hub asks for the next
   increment from the request's remaining features and TASKS.md, within a declared budget of
   attempts and wall clock; the controller's stop rules bound each increment. Not a new
   planner; the existing plan step scoped to "the next playable increment".

4. **Restart continuity** (REMEMBER). A run started on a workspace with history opens with the
   task ledger, notes, lessons and the last accepted checkpoint, and states what is unfinished.
   Mostly exists; M2 makes it a check.

5. **Desktop measurement** (M5). A small sampler that records hub + model RSS, tokens/s from
   callStats, and the client's longest frame stall, into the run record.

## The model

Local by default: qwen2.5-coder:1.5b via ollama is what this desktop runs (3B works slowly;
7B crashes it - a standing rule). The honest risk is capability: the 1.5B failed the
single-prompt protocol on tasks smaller than a game, and every game-building success in this
project's history came from a 14B/30B model or a hosted 7B. The milestone will therefore be
attempted with the local 1.5B first and, if it cannot produce M1, with the hosted 7B as the
capability control - which is a spend decision and needs authorization. The loop's software
(check, remember, improve, continue) is the same either way and is what this milestone is
meant to demonstrate.

## Order of local work (no spend)

    1  game check: declared play script run by the evaluator; a hand-written farming page as
       the POSITIVE control (passes) and a broken one as the NEGATIVE control (fails) - the
       check must be able to fail
    2  lessons: module + tool + auto-capture + two retrieval points; replay test proving
       context scoping (a JS lesson is retrieved for a JS error, not for a Python one) and
       restart survival
    3  increment selection + restart continuity; replay test: M2 and M3 shape with scripted
       replies (the checks and the loop, not the model)
    4  desktop sampler
    5  the live session on the local 1.5B: M1-M5 measured; then, if M1 fails on capability,
       the hosted-7B control under an authorized cap

What the controller and replay rig are for here: keeping M2/M3's "without breaking earlier
work" true and making every step of the live session replayable. They are instruments, not
the result.
