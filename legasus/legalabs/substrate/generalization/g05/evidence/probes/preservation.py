import settings
assert settings.DEFAULTS.get("retries") == 1, settings.DEFAULTS
assert settings.get("retries") == 1
assert settings.get("nope") is None
print("OK")
