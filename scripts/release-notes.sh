#!/usr/bin/env bash
#
# Print the CHANGELOG.md section for one version, which becomes the body of the
# GitHub release. Fails when the section is missing or empty, so a release
# without notes is caught before anything is built or published.
#
# Usage:
#   scripts/release-notes.sh            # the version in the root VERSION file
#   scripts/release-notes.sh 1.2.0+3    # a specific version
#

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/release-notes.sh           # the version in the root VERSION file
  scripts/release-notes.sh VERSION   # notes for the given version
  scripts/release-notes.sh --help
EOF
}

# Print an error the way GitHub Actions renders as a failure annotation, and
# plainly enough to read in a local terminal, then stop.
fail() {
  echo "::error::$1" >&2
  exit 1
}

# Print the body of the `## [version]` section, stripped of the blank lines
# around it. The version contains `+`, a regex metacharacter, so the heading is
# matched as a literal prefix rather than as a pattern.
extract_section() {
  local changelog="$1" heading="$2"

  awk -v heading="$heading" '
    index($0, heading) == 1 { inside = 1; next }
    inside && /^## / { exit }
    inside {
      lines[++count] = $0
      if (NF) { if (!first) first = count; last = count }
    }
    END { if (last) for (i = first; i <= last; i++) print lines[i] }
  ' "$changelog"
}

main() {
  if [ "${1:-}" = "--help" ]; then
    usage
    exit 0
  fi

  if [ $# -gt 1 ]; then
    usage >&2
    exit 1
  fi

  local repo_root version changelog notes
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  changelog="$repo_root/CHANGELOG.md"

  [ -f "$changelog" ] || fail "CHANGELOG.md not found at the repository root"

  if [ $# -gt 0 ]; then
    version="$1"
  else
    version="$("$repo_root/scripts/release-version.sh" | sed -n 's/^version=//p')"
  fi

  notes="$(extract_section "$changelog" "## [$version]")"

  if [ -z "$notes" ]; then
    fail "CHANGELOG.md has no section with content for $version. Add a heading of the exact form '## [$version] - YYYY-MM-DD'."
  fi

  printf '%s\n' "$notes"
}

main "$@"
