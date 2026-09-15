// ORACLE INSERTION SITES for goals 64 and 74, taken from the PROVEN reference patches.
//
// These are deliberately hand-written. The whole point of the feasibility experiment is to GIVE AWAY
// the site-selection problem so that model capability can be measured on its own. Nothing here is a
// claim that a future architecture can derive these sites.
//
// Each site carries:
//   anchor      a string that must occur EXACTLY ONCE in the CURRENT source; the insertion goes
//               immediately after it. Re-checked against source_{n-1} at every step, never
//               pre-computed against the original.
//   indent      the column the inserted code belongs at. Supplied, not inferred - the anchor's last
//               line is not a reliable guide (site 2 ends inside a 12-space block but inserts a
//               4-space def).
//   purpose     one line of ORACLE intent, given to the model. This is additional oracle information
//               beyond the location, and it is recorded as such: the experiment answers "given
//               correct localization AND correct decomposition, can the model write the snippet?"
//   reference   the known-good snippet. Used ONLY by the no-model control, never shown to the model.
const FENCE = String.fromCharCode(96, 96, 96);
const EMIT = 'blocks.append("<pre><code>" + _escape("\\n".join(fence)) + "</code></pre>")';

export const SITES = {
  64: {
    file: 's4_markdown.py',
    fn: 'to_html',
    sites: [
      { anchor: '    items = []\n', indent: 4,
        purpose: 'declare the accumulator list for ordered-list items, beside the existing items list',
        purpose_b1: 'declare a separate ordered-list accumulator named `ol_items`, initialised to an empty list; do not modify or redeclare `items`',
        reference: '    ol_items = []\n' },

      { anchor: '    def flush_list():\n        if items:\n            blocks.append("<ul>" + "".join("<li>" + _inline(i) + "</li>" for i in items) + "</ul>")\n            del items[:]\n',
        indent: 4,
        purpose: 'define a flush function for ordered lists, mirroring flush_list but emitting <ol>',
        purpose_b1: 'define a nested function named `flush_ol` that mirrors the existing `flush_list` but emits an <ol> block from `ol_items` instead of a <ul> from `items`, and clears `ol_items` afterwards; do not modify `flush_list`',
        reference: '\n    def flush_ol():\n        if ol_items:\n            blocks.append("<ol>" + "".join("<li>" + _inline(i) + "</li>" for i in ol_items) + "</ol>")\n            del ol_items[:]\n' },

      { anchor: '            flush_list()\n            continue\n', indent: 12,
        purpose: 'a blank line must also close an open ordered list',
        purpose_b1: 'call `flush_ol()` here and nothing else, so a blank line also closes an open ordered list',
        reference: '            flush_ol()\n' },

      { anchor: '        if line.startswith("- "):\n            flush_para()\n', indent: 12,
        purpose: 'an unordered-list line must close an open ordered list',
        purpose_b1: 'call `flush_ol()` here and nothing else, so an unordered-list line closes an open ordered list',
        reference: '            flush_ol()\n' },

      { anchor: '            items.append(line[2:].strip())\n            continue\n', indent: 8,
        purpose: 'the new branch: a line starting with a number, a dot and a space is an ordered-list item; close any paragraph and unordered list, collect the text after the marker, and continue',
        purpose_b1: 'add a new branch for ordered-list items: when the line starts with a number, a dot and a space, close any open paragraph and any open unordered list, append the item text after the marker to `ol_items`, and continue; do not alter the existing branches',
        reference: '        m_ol = re.match(r"^\\d+\\. (.*)$", line)\n        if m_ol:\n            flush_para()\n            flush_list()\n            ol_items.append(m_ol.group(1).strip())\n            continue\n' },

      { anchor: '        flush_list()\n        h = _is_heading(line)\n', indent: 8,
        purpose: 'any other kind of line must close an open ordered list',
        purpose_b1: 'call `flush_ol()` here and nothing else, so any other kind of line closes an open ordered list',
        reference: '        flush_ol()\n' },

      { anchor: '    flush_para()\n    flush_list()\n', indent: 4,
        purpose: 'the end of the input must flush an ordered list that is still open',
        purpose_b1: 'call `flush_ol()` here and nothing else, so the end of the input flushes an ordered list that is still open',
        reference: '    flush_ol()\n' },
    ],
  },

  74: {
    file: 's4_markdown.py',
    fn: 'to_html',
    sites: [
      { anchor: '    items = []\n', indent: 4,
        purpose: 'declare the fenced-code-block state: None when not inside a fence, otherwise the list of collected lines',
        purpose_b1: 'declare a variable named `fence`, initialised to None, which is None when not inside a fenced code block and otherwise holds the collected lines; do not modify or redeclare `items`',
        reference: '    fence = None\n' },

      { anchor: '    for line in str(text).split("\\n"):\n', indent: 8,
        purpose: 'handle fences before every other line rule: while inside a fence, a closing ' + FENCE + ' line emits <pre><code> with the collected lines joined by newlines and escaped, otherwise the line is collected verbatim; when not inside a fence, a ' + FENCE + ' line closes any open paragraph and list and opens one',
        purpose_b1: 'handle fenced code blocks before every other line rule, using the `fence` variable: while inside a fence, a line whose stripped value is ' + FENCE + ' emits the collected lines as one escaped <pre><code> block with their line breaks preserved and leaves the fence, and any other line is collected verbatim, continuing either way; while not inside a fence, a line whose stripped value is ' + FENCE + ' closes any open paragraph and unordered list and enters a fence; do not alter the existing branches',
        reference: '        if fence is not None:\n'
          + '            if line.strip() == "' + FENCE + '":\n'
          + '                ' + EMIT + '\n'
          + '                fence = None\n'
          + '            else:\n'
          + '                fence.append(line)\n'
          + '            continue\n'
          + '        if line.strip() == "' + FENCE + '":\n'
          + '            flush_para()\n'
          + '            flush_list()\n'
          + '            fence = []\n'
          + '            continue\n' },

      { anchor: '    flush_para()\n    flush_list()\n', indent: 4,
        purpose: 'a fence that was never closed must still be emitted at the end of the input',
        purpose_b1: 'if `fence` is still open at the end of the input, emit its collected lines as one escaped <pre><code> block the same way; add nothing else',
        reference: '    if fence is not None:\n        ' + EMIT + '\n' },
    ],
  },
};

// Locate a site in the CURRENT source. Uniqueness is a precondition, re-established every step.
export function locate(src, site) {
  const n = src.split(site.anchor).length - 1;
  if (n === 0) return { ok: false, why: 'anchor_lost' };
  if (n > 1) return { ok: false, why: 'anchor_ambiguous (' + n + ' occurrences)' };
  const at = src.indexOf(site.anchor) + site.anchor.length;
  return { ok: true, at, before: src.slice(0, at), after: src.slice(at) };
}
