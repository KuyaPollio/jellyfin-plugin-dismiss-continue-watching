#!/bin/bash

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Error: Version argument is required"
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.0"
    exit 1
fi

VERSION="$1"

if ! [[ "$VERSION" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-.*)?$ ]]; then
    echo "Error: Invalid version format. Expected semver format (e.g., 1.0.0 or 1.0.0-beta.1)"
    exit 1
fi

CLEAN_VERSION="${VERSION#v}"
ASSEMBLY_VERSION="${CLEAN_VERSION%%-*}.0"

echo "Updating version to: $CLEAN_VERSION"
echo "Assembly version: $ASSEMBLY_VERSION"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_FILE="$SCRIPT_DIR/../Jellyfin.Plugin.DismissContinueWatching/Jellyfin.Plugin.DismissContinueWatching.csproj"

if [ ! -f "$PROJECT_FILE" ]; then
    echo "Error: Project file not found: $PROJECT_FILE"
    exit 1
fi

# macOS-compatible sed in-place
if [[ "$(uname)" == "Darwin" ]]; then
    SED_INPLACE=(sed -i '')
else
    SED_INPLACE=(sed -i)
fi

"${SED_INPLACE[@]}" "s|<AssemblyVersion>.*</AssemblyVersion>|<AssemblyVersion>$ASSEMBLY_VERSION</AssemblyVersion>|g" "$PROJECT_FILE"
"${SED_INPLACE[@]}" "s|<FileVersion>.*</FileVersion>|<FileVersion>$ASSEMBLY_VERSION</FileVersion>|g" "$PROJECT_FILE"
"${SED_INPLACE[@]}" "s|<PluginVersion>.*</PluginVersion>|<PluginVersion>$CLEAN_VERSION</PluginVersion>|g" "$PROJECT_FILE"

echo "Version updated successfully!"
