#!/bin/bash
# Gera public/js/version.js com dados do último commit git.
# Executar após cada git pull: bash scripts/update-version.sh

cd "$(dirname "$0")/.."

HASH=$(git log -1 --format="%h" 2>/dev/null || echo "dev")
DATE=$(git log -1 --format="%cd" --date=format:"%d/%m/%Y" 2>/dev/null || date "+%d/%m/%Y")
COUNT=$(git log --oneline 2>/dev/null | wc -l | tr -d ' ')
VERSION="1.${COUNT}"

cat > public/js/version.js <<EOF
const APP_VERSION = { v: '${VERSION}', hash: '${HASH}', date: '${DATE}', commits: ${COUNT} };
EOF

echo "✓ Versão gerada: ${VERSION} (${HASH}) — ${DATE}"
