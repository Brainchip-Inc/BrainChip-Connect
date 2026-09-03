#!/usr/bin/env bash
#
# Remove generated files that are intentionally ignored by this repo.
# Default mode is dry-run. Use --apply to perform deletions.
#

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/clean_generated_files.sh           # dry-run
  scripts/clean_generated_files.sh --apply   # delete files/directories
  scripts/clean_generated_files.sh --help
EOF
}

MODE="dry-run"
if [[ "${1:-}" == "--apply" ]]; then
  MODE="apply"
elif [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
elif [[ $# -gt 0 ]]; then
  echo "Unknown option: $1"
  usage
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TARGETS=(
  "Gemfile.lock"
  "ios/Podfile.lock"
  "ios/BrainChipConnect.xcworkspace"
)

echo "Mode: $MODE"
echo "Repo: $REPO_ROOT"
echo

removed_count=0
missing_count=0

for rel_path in "${TARGETS[@]}"; do
  abs_path="$REPO_ROOT/$rel_path"
  if [[ -e "$abs_path" ]]; then
    if [[ "$MODE" == "apply" ]]; then
      rm -rf "$abs_path"
      echo "REMOVED  $rel_path"
    else
      echo "WOULD REMOVE  $rel_path"
    fi
    ((removed_count+=1))
  else
    echo "MISSING  $rel_path"
    ((missing_count+=1))
  fi
done

echo
if [[ "$MODE" == "apply" ]]; then
  echo "Done. Removed $removed_count path(s), $missing_count already missing."
else
  echo "Dry run complete. $removed_count path(s) would be removed, $missing_count already missing."
  echo "Run with --apply to delete them."
fi
