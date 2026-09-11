# Reference solution (final state of chain r6) - used only to prove checks-D.mjs can pass.
import calendar
import datetime as dt
import re

_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def parse(s):
    if isinstance(s, dt.datetime):
        return s.date()
    if isinstance(s, dt.date):
        return s
    if not isinstance(s, str) or not _ISO.match(s):
        raise ValueError(f"not a YYYY-MM-DD date: {s!r}")
    return dt.date.fromisoformat(s)


def fmt(d):
    return parse(d).isoformat()


def add_days(s, n):
    return fmt(parse(s) + dt.timedelta(days=n))


def is_weekend(s):
    return parse(s).weekday() >= 5


def _hol(holidays):
    return {parse(h) for h in holidays}


def _off(d, hol):
    return d.weekday() >= 5 or d in hol


def add_business_days(s, n, holidays=()):
    d, hol = parse(s), _hol(holidays)
    while n > 0:
        d += dt.timedelta(days=1)
        if not _off(d, hol):
            n -= 1
    return fmt(d)


def business_days_between(a, b, holidays=()):
    a, b, hol = parse(a), parse(b), _hol(holidays)
    count, d = 0, a
    while d < b:
        d += dt.timedelta(days=1)
        if not _off(d, hol):
            count += 1
    return count


def month_end(s):
    d = parse(s)
    return fmt(d.replace(day=calendar.monthrange(d.year, d.month)[1]))


def add_months(s, n):
    d = parse(s)
    m = d.month - 1 + n
    y, m = d.year + m // 12, m % 12 + 1
    return fmt(dt.date(y, m, min(d.day, calendar.monthrange(y, m)[1])))


def iso_week(s):
    y, w, _ = parse(s).isocalendar()
    return (y, w)


def weekday_name(s):
    return _NAMES[parse(s).weekday()]


def next_weekday(s, name):
    names = [x.lower() for x in _NAMES]
    if not isinstance(name, str) or name.lower() not in names:
        raise ValueError(f"unknown weekday: {name!r}")
    d = parse(s)
    ahead = (names.index(name.lower()) - d.weekday() - 1) % 7 + 1
    return fmt(d + dt.timedelta(days=ahead))
