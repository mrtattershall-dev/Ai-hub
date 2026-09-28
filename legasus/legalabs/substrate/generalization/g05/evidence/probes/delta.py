import settings
assert settings.DEFAULTS.get("timeout") == 30, settings.DEFAULTS
assert settings.timeout_of() == 30, settings.timeout_of()
assert settings.get("timeout") == 30
assert settings.get("retries") == 1, "the existing default must be unchanged"
print("OK")
