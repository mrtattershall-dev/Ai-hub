# POSITIVE WITNESS for probe goal54.lists - the canonical seed plus goal 54 and nothing else.
# Used only to prove the probe accepts a correct implementation. Never shown to the model.
import re

_CODE = "\x00CODE%d\x00"


def _escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline(text):
    codes = []

    def take(m):
        codes.append("<code>" + _escape(m.group(1)) + "</code>")
        return _CODE % (len(codes) - 1)

    text = re.sub(r"`([^`]*)`", take, text)
    text = _escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)
    for i, c in enumerate(codes):
        text = text.replace(_CODE % i, c)
    return text


def _is_heading(line):
    m = re.match(r"^(#{1,3}) (.*)$", line)
    return (len(m.group(1)), m.group(2)) if m else None


def to_html(text):
    blocks = []
    current = []
    items = []          # goal 54: consecutive "- " lines

    def flush_para():
        if current:
            blocks.append("<p>" + _inline(" ".join(current)) + "</p>")
            del current[:]

    def flush_list():
        if items:
            blocks.append("<ul>" + "".join("<li>" + _inline(i) + "</li>" for i in items) + "</ul>")
            del items[:]

    for line in str(text).split("\n"):
        if line.strip() == "":
            flush_para()
            flush_list()
            continue
        if line.startswith("- "):
            flush_para()
            items.append(line[2:].strip())
            continue
        flush_list()
        h = _is_heading(line)
        if h:
            flush_para()
            level, body = h
            blocks.append("<h%d>%s</h%d>" % (level, _inline(body), level))
            continue
        current.append(line.strip())
    flush_para()
    flush_list()
    return "\n".join(blocks)
