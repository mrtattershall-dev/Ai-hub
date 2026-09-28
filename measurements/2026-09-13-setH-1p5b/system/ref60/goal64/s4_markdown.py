# CONFINEMENT WITNESS for goal 64 (ordered lists) - the post-60 seed with goal 64 and nothing else.
# Used ONLY to prove, before any generation, that the correct delta lives entirely inside to_html.
# Never shown to the model.
import re

_CODE = "\x00CODE%d\x00"
_LINK = "\x00LINK%d\x00"


def _escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline(text):
    codes = []
    links = []

    def take_code(m):
        codes.append("<code>" + _escape(m.group(1)) + "</code>")
        return _CODE % (len(codes) - 1)

    text = re.sub(r"`([^`]*)`", take_code, text)

    def take_link(m):
        label = _escape(m.group(1))
        url = _escape(m.group(2)).replace('"', "&quot;")
        links.append('<a href="' + url + '">' + label + "</a>")
        return _LINK % (len(links) - 1)

    text = re.sub(r"\[([^\]]*)\]\(([^)]*)\)", take_link, text)

    text = _escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)

    for i, c in enumerate(codes):
        text = text.replace(_CODE % i, c)
    for i, a in enumerate(links):
        text = text.replace(_LINK % i, a)
    return text


def _is_heading(line):
    m = re.match(r"^(#{1,3}) (.*)$", line)
    return (len(m.group(1)), m.group(2)) if m else None


def to_html(text):
    blocks = []
    current = []
    items = []
    nums = []

    def flush_para():
        if current:
            blocks.append("<p>" + _inline(" ".join(current)) + "</p>")
            del current[:]

    def flush_list():
        if items:
            blocks.append("<ul>" + "".join("<li>" + _inline(i) + "</li>" for i in items) + "</ul>")
            del items[:]

    def flush_ol():
        if nums:
            blocks.append("<ol>" + "".join("<li>" + _inline(i) + "</li>" for i in nums) + "</ol>")
            del nums[:]

    for line in str(text).split("\n"):
        if line.strip() == "":
            flush_para()
            flush_list()
            flush_ol()
            continue
        if line.startswith("- "):
            flush_para()
            flush_ol()
            items.append(line[2:].strip())
            continue
        m = re.match(r"^\d+\. (.*)$", line)
        if m:
            flush_para()
            flush_list()
            nums.append(m.group(1).strip())
            continue
        flush_list()
        flush_ol()
        h = _is_heading(line)
        if h:
            flush_para()
            level, body = h
            blocks.append("<h%d>%s</h%d>" % (level, _inline(body), level))
            continue
        current.append(line.strip())
    flush_para()
    flush_list()
    flush_ol()
    return "\n".join(blocks)


if __name__ == "__main__":
    assert to_html("1. one\n2. two") == "<ol><li>one</li><li>two</li></ol>"
    assert to_html("- a") == "<ul><li>a</li></ul>"
    assert to_html("a\nb") == "<p>a b</p>"
    print("ok")
