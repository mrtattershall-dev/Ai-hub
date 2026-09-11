# run5 on the hub - live notes (hand verification, written as results arrive)

## First 12 goals of set A: run5 LOOPS. Scorer 7/12 "work" vs base 17/20; 9 of 12 runs "stopped".

Every run5 stop is the hub's repeat detector: "the model produced the same response 3 times in
the last N steps without making progress" - after only 3-5 model calls (the base's stops come
after 6-11). Checked it is real, not a detector artifact: goal 1's history holds five assistant
replies; replies 3, 4 and 5 are BYTE-IDENTICAL (401 chars). It wrote a correct t1_temp.js, got
"OK: wrote", then appended the same test block twice - the second copy redeclared assert and c,
the file stopped parsing, and the hub restored the last committed version.

WHY (measured, not guessed): training-data/factory/trained_run5.jsonl, the 13,762 rows run5
was trained on -
    assistant turns per row:            1 in ALL 13,762 rows
    rows containing a hub tool result:  0
    rows in the hub's THOUGHT/ACTION format: 0
run5 was trained purely as a one-shot code writer (and scored 22/32 one-shot on the 2026-09-09
eval). It never saw a tool result followed by a next move, so in the agent loop it does not
condition on what just happened - it re-sends its previous reply. The adapter does follow the
hub's action FORMAT (it parses), because the base model already could.

Also visible: run5 writes CRLF line endings inside code ("\r\n" in every write_file), a
trained-in trait from Windows-sourced data. Harmless to node/python, but it is how the
identity check told the adapter was really loaded.

IMPLICATION for any future fine-tune aimed at the hub: the data must be MULTI-TURN hub
traces (reply -> tool result -> next reply), or the adapter trades the base model's ability to
work through a loop for one-shot style. FineTome-style chat data would not fix this either.
