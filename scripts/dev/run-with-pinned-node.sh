#!/bin/sh

set -eu

PINNED_NODE_BIN="/opt/homebrew/opt/node@22/bin/node"

if [ ! -x "$PINNED_NODE_BIN" ]; then
  echo "Expected pinned Node binary at $PINNED_NODE_BIN. Install node@22 with Homebrew first." >&2
  exit 1
fi

exec "$PINNED_NODE_BIN" "$@"
