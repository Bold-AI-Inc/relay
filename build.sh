#!/usr/bin/env bash
# Builds the Chrome Web Store upload package.
# Produces ./linear-screenshot-extension.zip with only the files that ship.

set -euo pipefail
cd "$(dirname "$0")"

OUT="linear-screenshot-extension.zip"
rm -f "$OUT"

# Refuse to build if the OAuth client_id placeholder still looks empty AND no
# tag override is set, to make accidental "empty config" uploads unlikely.
if grep -q "self.LINEAR_OAUTH_CLIENT_ID = ''" config.js; then
  echo "⚠️  config.js has an empty LINEAR_OAUTH_CLIENT_ID — the published build will only allow the API-key fallback." >&2
  echo "   Set it in config.js before publishing, or press Enter to build anyway." >&2
  read -r _
fi

zip -r "$OUT" . \
  -x ".git/*" \
  -x ".gitignore" \
  -x "*.DS_Store" \
  -x "README.md" \
  -x "PUBLISHING.md" \
  -x "CHANGELOG.md" \
  -x "build.sh" \
  -x "store/*" \
  -x "icons/icon512.png" \
  -x "*.zip" \
  >/dev/null

SIZE=$(du -h "$OUT" | cut -f1)
FILES=$(unzip -l "$OUT" | awk '/^----/{flag++;next} flag==1{print "  "$NF}' | grep -v '^  $')
echo "✓ Built $OUT ($SIZE)"
echo "$FILES"
echo ""
echo "Upload to: https://chrome.google.com/webstore/devconsole"
