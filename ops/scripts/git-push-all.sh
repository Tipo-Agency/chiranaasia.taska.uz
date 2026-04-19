#!/usr/bin/env bash
# Пуш текущей ветки во все remotes (вариант 1: origin + chiranaasia).
# Настройка один раз в корне клона:
#   git remote add chiranaasia git@github.com:Tipo-Agency/chiranaasia.taska.uz.git
# Запуск: ./ops/scripts/git-push-all.sh   или   ./ops/scripts/git-push-all.sh main
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
branch="${1:-$(git branch --show-current)}"
for remote in $(git remote); do
  echo "→ git push $remote $branch"
  git push "$remote" "$branch"
done
