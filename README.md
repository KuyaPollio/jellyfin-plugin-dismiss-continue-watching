# jellyfin-plugin-dismiss-continue-watching

Dismiss items from Jellyfin's **Continue Watching** section by marking them as watched.

Derived from [jon4hz/jellyfin-plugin-discontinue-watching](https://github.com/jon4hz/jellyfin-plugin-discontinue-watching) (GPLv3), simplified to use Jellyfin's native played API instead of a custom denylist.

## About

This plugin injects a dismiss (×) button on each Continue Watching card in the Jellyfin web UI. Clicking it:

1. Marks the item as **played** for the current user (`POST /Users/{userId}/PlayedItems/{itemId}`)
2. Removes the card from the page

Your watch progress is replaced by a played status (same as marking the item watched manually).

## Supported clients

Works by injecting JavaScript into Jellyfin's web interface:

- Jellyfin Web
- Official Jellyfin Android / iOS / Desktop apps (web UI)
- Not supported: pure third-party clients

## Requirements

- [Jellyfin-JavaScript-Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) (**required**)
- [jellyfin-plugin-file-transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) (optional, recommended)

## Installation

1. Open Jellyfin Dashboard → **Plugins** → **Catalog**
2. Click **Repositories** → **+** and add:

   ```
   https://raw.githubusercontent.com/KuyaPollio/jellyfin-plugin-dismiss-continue-watching/main/manifest.json
   ```

3. Find **DismissContinueWatching** in the catalog and install it
4. Install **JavaScript Injector** if you have not already
5. Restart Jellyfin
6. Enable the plugin under **Plugins** → **My Plugins**
7. Hard-refresh the web client

## Development

```bash
make build
make package
```

Requires .NET SDK matching `global.json` (9.x).

## Credits

- [jon4hz/jellyfin-plugin-discontinue-watching](https://github.com/jon4hz/jellyfin-plugin-discontinue-watching) — original plugin architecture, JS Injector registration, and Continue Watching button injection
- [KefinTweaks](https://github.com/ranaldsgift/KefinTweaks) — Continue Watching UI patterns

## License

[GPLv3](LICENSE) — same as the upstream project this is derived from.
