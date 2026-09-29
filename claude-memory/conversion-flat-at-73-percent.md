---
name: conversion-flat-at-73-percent
description: "Set H 39/53 and set K 27/37 both convert ~73% of goals ATTEMPTED, across 20+ hub fixes — score differences between sets are reach, not quality"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T20:15:10.926Z
---

Measured 2026-09-12 across two 100-goal sets on the same goals, same checker, same MoE
(Qwen3-Coder-30B-A3B): set H 39 correct of 53 attempted = **73.6%**; set K 27 of 37 = **73.0%**. Set K served
three additional fixes (context window `d80b38f`, class-method outline `579a41a`, refusal hand-back `6ae7db8`),
all verified firing in production. Conversion moved **−0.6 points**.

**Why:** published scores (39/100, 27/100) differ almost entirely because of how many goals got STARTED, not how
well they were done. Set K attempted fewer because 83+ minutes of a 172-minute window went on serving latency
before each goal's first step. Comparing raw /100 scores across sets compares reach, and reads as a quality
change that isn't there.

**How to apply:** report score per goal ATTEMPTED alongside score/100, always. When a hub change is supposed to
improve quality, conversion is the number that can show it — /100 cannot separate it from window effects. And
treat ~73% as the standing baseline: three more fixes did not move it, which says the remaining 27% is not the
hub refusing, mis-editing, or losing context. Goal 11 of that goal set is the canonical case — it died on the
call budget with zero errors, zero refusals and zero hub notes, chasing a contradiction in four debug scripts it
wrote itself.

Related: [[goal-coupling-wrong-denominator]], [[setG-result-budget-is-the-ceiling]], [[model-self-verification-gap]].
