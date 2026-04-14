#!/usr/bin/env bash
# Узкий скан apps/api/app на типичные утечки (PEM, AWS access key id). Снижает риск случайного коммита секретов.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if rg -q 'BEGIN [A-Z0-9 ]+PRIVATE KEY' apps/api/app 2>/dev/null; then
  echo "check_api_secrets: найден фрагмент PEM private key в apps/api/app"
  exit 1
fi
if rg -n 'AKIA[0-9A-Z]{16}' apps/api/app 2>/dev/null; then
  echo "check_api_secrets: найдена строка похожая на AWS Access Key ID (AKIA...)"
  exit 1
fi
echo "check_api_secrets: OK"
