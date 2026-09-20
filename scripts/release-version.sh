#!/usr/bin/env bash
#
# Turn a `major.minor.patch+build` version into the identifiers a release needs:
# the version name people read, the integer version code Google Play orders
# uploads by, and the git tag.
#
# Usage:
#   scripts/release-version.sh            # reads the root VERSION file
#   scripts/release-version.sh 1.2.0+3    # checks a version without editing it
#
# Prints `key=value` lines, which a GitHub Actions step appends straight to
# $GITHUB_OUTPUT and a shell can source.
#

set -euo pipefail

# Play orders uploads by version code and refuses one it has already accepted,
# so the code is the base-100 positional encoding of the four version
# components. A positional encoding whose components all stay below the base is
# strictly increasing in the natural ordering of the version, so two different
# versions can never produce the same code and a higher version can never
# produce a lower one. The ceilings below are what keep every component below
# the base, and MAX_MAJOR is also what keeps the result under Play's own
# 2100000000 limit: 2099.99.99+99 encodes to 2099999999.
readonly COMPONENT_BASE=100
readonly MAX_MAJOR=2099
readonly MAX_COMPONENT=99

usage() {
  cat <<'EOF'
Usage:
  scripts/release-version.sh           # reads the root VERSION file
  scripts/release-version.sh VERSION   # checks the given version string
  scripts/release-version.sh --help
EOF
}

# Print an error the way GitHub Actions renders as a failure annotation, and
# plainly enough to read in a local terminal, then stop.
fail() {
  echo "::error::$1" >&2
  exit 1
}

# Print the version to work on: the argument when there is one, and the
# contents of the root VERSION file otherwise.
read_version() {
  if [ $# -gt 0 ]; then
    printf '%s' "$1"
    return
  fi

  local repo_root version_file
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  version_file="$repo_root/VERSION"

  [ -f "$version_file" ] || fail "VERSION not found at the repository root"
  tr -d '[:space:]' <"$version_file"
}

# Print the four components of a version, space separated, rejecting anything
# that is not `major.minor.patch+build` or that would break the version code
# encoding described above.
parse_version() {
  local version="$1"

  [ -n "$version" ] || fail "the version is empty"

  if ! [[ "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+)$ ]]; then
    fail "version '$version' is not of the form major.minor.patch+build, for example 1.2.0+0"
  fi

  local major="${BASH_REMATCH[1]}"
  local minor="${BASH_REMATCH[2]}"
  local patch="${BASH_REMATCH[3]}"
  local build="${BASH_REMATCH[4]}"

  [ "$major" -le "$MAX_MAJOR" ] ||
    fail "version '$version' has major $major, above the $MAX_MAJOR that fits Play's version code limit"

  local component
  for component in "$minor" "$patch" "$build"; do
    [ "$component" -le "$MAX_COMPONENT" ] ||
      fail "version '$version' has a component above $MAX_COMPONENT, which the version code encoding cannot represent"
  done

  echo "$major $minor $patch $build"
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

  local version components major minor patch build
  version="$(read_version "$@")"
  # Assigned in its own statement so that a rejected version stops the script:
  # a command substitution inside the `read` below would lose the exit status.
  components="$(parse_version "$version")"
  read -r major minor patch build <<<"$components"

  echo "version=$version"
  echo "version_name=$major.$minor.$patch"
  echo "version_code=$((((major * COMPONENT_BASE + minor) * COMPONENT_BASE + patch) * COMPONENT_BASE + build))"
  echo "tag=v$version"
}

main "$@"
