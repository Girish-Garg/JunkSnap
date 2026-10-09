"""Settings, read from the exact environment variable names in contracts/README.md.

`CoreSettings` (core.py) holds what every workload needs. A task that needs more variables
adds `settings/<topic>.py` with `class <Topic>Settings(EnvSettings)`, one field per variable
with `Field(alias="EXACT_NAME")`, and its builder calls `<Topic>Settings.load()`.
"""
