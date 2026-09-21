"""CONTROL-1 corpus. Each function is a preregistered positive or negative control.

Nothing here is imported or executed; the scanner parses it. The manifest that says which
function must flag and which must not is CONTROL-1_PREREG.md, frozen before this file existed.
"""
READY_HOSTS = {"a", "b"}


# ---- A1: the purest instance of INV-A. The error path reports the success value, and there is
# ---- NO literal failure return anywhere. Predicted MISSED by the current detector.
def upload_ok():
    try:
        _do_upload()
        return True
    except Exception:
        return True


# ---- A2: variant surface form - a truthy NON-bool from the handler, with a literal failure
# ---- return present elsewhere. Predicted FLAGGED.
def sync_records():
    try:
        _do_sync()
        return 1
    except Exception:
        return 1
    finally:
        pass


def sync_records_with_failure_path(n):
    if n < 0:
        return False
    try:
        _do_sync()
        return 1
    except Exception:
        return 1


# ---- A-NEG: polarity inverted. True means THE PROBLEM IS PRESENT, so returning True from the
# ---- handler is fail-safe. Must NOT flag. Predicted FALSELY FLAGGED.
def token_missing(path):
    if not path:
        return False
    try:
        _read_token(path)
        return False
    except Exception:
        return True


# ---- B1: a check-named function that cannot fail. Predicted FLAGGED.
def is_ready():
    return True


# ---- B2: variant surface form - truthy in two branches, no falsey return, no raise.
# ---- Predicted FLAGGED.
def has_access(user):
    if user:
        return True
    return True


# ---- B-NEG: an ordinary computed boolean with an early truthy return. Obviously CAN be false.
# ---- Must NOT flag. Predicted FALSELY FLAGGED.
def is_ready_host(host):
    if not host:
        return True
    return host in READY_HOSTS


def _do_upload():
    pass


def _do_sync():
    pass


def _read_token(path):
    return path
