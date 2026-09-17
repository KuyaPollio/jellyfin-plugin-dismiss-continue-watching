# jellyfin-plugin-dismiss-continue-watching

Dismiss items from Jellyfin's **Continue Watching** section and keep them hidden across all clients.

Derived from [jon4hz/jellyfin-plugin-discontinue-watching](https://github.com/jon4hz/jellyfin-plugin-discontinue-watching) (GPLv3).

## About

This plugin adds a dismiss (×) button on Continue Watching cards in the Jellyfin web UI. Clicking it:

1. Adds the item to a per-user **denylist** (persisted server-side)
2. Marks the item as played (best-effort, for immediate UI feedback)
3. Removes the card from the page

Dismissed items stay hidden after refresh. A built-in server middleware intercepts Resume API calls (`/UserItems/Resume`, `/Users/{id}/Items/Resume`) so the same denylist applies to **mobile and TV apps** — no reverse-proxy configuration required.

## Supported clients

| Client | Dismiss button | Hidden after dismiss |
|--------|----------------|----------------------|
| Jellyfin Web | Yes | Yes |
| Android / iOS / TV apps | No (no custom UI) | Yes |
| Direct IP access | Yes (web) | Yes (all clients) |

## Requirements

- Jellyfin Server **12.0+**
- [Jellyfin-JavaScript-Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector) (**required** for the web button)
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

Requires .NET SDK matching `global.json` (10.x) and Jellyfin Server 12.0+.

## Credits

- [jon4hz/jellyfin-plugin-discontinue-watching](https://github.com/jon4hz/jellyfin-plugin-discontinue-watching) — denylist, Resume API override, JS Injector registration
- [SloMR/jellyfin-plugin-dedupe-continue-watching](https://github.com/SloMR/jellyfin-plugin-dedupe-continue-watching) — middleware pattern for Resume API interception
- [KefinTweaks](https://github.com/ranaldsgift/KefinTweaks) — Continue Watching UI patterns

## License

[GPLv3](LICENSE) — same as the upstream project this is derived from.
