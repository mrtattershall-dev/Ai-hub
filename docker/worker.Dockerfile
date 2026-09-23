# The campaign's agent worker.
#
# FROM a DIGEST, not a tag: a tag resolving differently between ARM A and ARM B would change the
# toolchain while every record still said the arms matched.
FROM node@sha256:b6f26b36c8ff49624cfdac716b8ea1138d606df02586a77d364bb5536a634f85

# run_python needs Python. Node being present does not imply it - the base image reported
# NO_PYTHON, which is exactly why this is checked rather than assumed.
#
# Dependencies are baked in HERE, at build time, because the worker runs with --network none.
# Anything a run needs must already be in the image; both arms therefore resolve identical
# dependencies, because they are the same image layer, not two network fetches.
RUN apk add --no-cache python3 git

# Matches the --user the worker runs as, so the workspace mount is writable.
USER 1000:1000
