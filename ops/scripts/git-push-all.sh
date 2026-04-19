#!/usr/bin/env bash
# Пуш текущей ветки во все remotes (вариант 1).
# В клоне tipa уже есть: origin → tipa, chiranaasia → второй репо.
# Если push в chiranaasia отклонён (remote впереди): подтяните тот репо отдельно
# (merge/rebase/cherry-pick), не гоните force без причины.
# Запуск: ./ops/scripts/git-push-all.sh   или   ./ops/scripts/git-push-all.sh main
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
branch="${1:-$(git branch --show-current)}"
# Сначала origin (основной), потом остальные — чтобы при ошибке на втором репо первый уже ушёл
remotes=$(git remote | grep -vx origin || true)
echo "→ git push origin $branch"
git push origin "$branch"
for remote in $remotes; do
  echo "→ git push $remote $branch"
  git push "$remote" "$branch"
done
