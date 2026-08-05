.PHONY: help build clean package install test restore lint

help:
	@echo "Jellyfin Plugin DismissContinueWatching - Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  build      - Build the plugin (Release configuration)"
	@echo "  debug      - Build the plugin (Debug configuration)"
	@echo "  clean      - Clean build artifacts"
	@echo "  package    - Build and create plugin package"
	@echo "  test       - Run tests and validation"
	@echo "  restore    - Restore NuGet packages"
	@echo "  lint       - Run code analysis"
	@echo "  version    - Update version (requires VERSION=x.y.z)"
	@echo ""
	@echo "Examples:"
	@echo "  make build"
	@echo "  make package"
	@echo "  make version VERSION=1.2.3"

build:
	cd build && ./build.sh --configuration Release

debug:
	cd build && ./build.sh --configuration Debug

package:
	cd build && ./build.sh --configuration Release --package

clean:
	cd build && ./build.sh --clean --configuration Release

restore:
	dotnet restore Jellyfin.Plugin.DismissContinueWatching.sln

test: build
	@echo "Testing build output..."
	@if [ ! -f "Jellyfin.Plugin.DismissContinueWatching/bin/Release/net9.0/Jellyfin.Plugin.DismissContinueWatching.dll" ]; then \
		echo "Build test failed - DLL not found"; \
		exit 1; \
	fi
	@echo "Build test passed"

lint:
	dotnet build Jellyfin.Plugin.DismissContinueWatching.sln \
		--configuration Release \
		--verbosity normal \
		/p:TreatWarningsAsErrors=true

version:
ifndef VERSION
	@echo "Error: VERSION not specified"
	@echo "Usage: make version VERSION=1.2.3"
	@exit 1
endif
	cd build && ./update-version.sh $(VERSION)

install: package
	@echo "Installing plugin to local Jellyfin..."
	sudo mkdir -p /var/lib/jellyfin/plugins/DismissContinueWatching
	sudo cp bin/plugin/*.dll /var/lib/jellyfin/plugins/DismissContinueWatching/
	@echo "Plugin installed. Restart Jellyfin to load the updated plugin."

uninstall:
	@echo "Removing plugin from local Jellyfin..."
	sudo rm -rf /var/lib/jellyfin/plugins/DismissContinueWatching
	@echo "Plugin removed. Restart Jellyfin to complete removal."

ci-build: restore lint build test

ci-package: ci-build package
