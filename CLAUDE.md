# Action Wheel

Shift + left-click on a file in Nautilus opens a radial action menu drawn by GNOME Shell. Target: GNOME Shell 46, Nautilus 46.

## How it fits together

1. `nautilus/action-wheel.vala` is a Nautilus extension module (`.so`). It adds a capture-phase Shift+LMB gesture to every Nautilus window, finds the file URI under the pointer, and on release calls D-Bus `org.gnome.Shell.Extensions.ActionWheel.Open(as uris)` on `/org/gnome/Shell/Extensions/ActionWheel`. On empty space in a local folder view it calls `OpenFolder(s uri)` with the folder URI instead.
2. `shell/action-wheel@diegolopes/extension.js` exports that D-Bus method and draws the wheel at the pointer. It also handles sub-pages, the Back button, animations, and mime filtering.
3. `shell/action-wheel@diegolopes/actions/` has one file per top-level wheel entry. `actions/index.js` sets the order: the default export is the file wheel, `FOLDER_ACTIONS` is the folder wheel. To add an action, follow `actions/README.md`.
4. `editor.js` is a separate GJS GTK4/Adw process for crop and rotate, started by the Image → Edit action. `trim.js` is the same kind of process for cutting a video, started by Video → Trim.
5. `util.js` has helpers shared by the Shell side and the editor. It imports only GLib, because the editor cannot load Shell modules. Shell-only helpers go in `actions/shell.js`.

## Build and install

| Command | Effect |
|---------|--------|
| `./install.sh --build-only` | Builds `build/libnautilus-action-wheel.so` with valac. |
| `./install.sh` | Builds, installs the `.so` with sudo, and symlinks the Shell extension into `~/.local/share/gnome-shell/extensions/`. It needs a real terminal for the sudo prompt. |
| `nautilus -q` | Reloads the Nautilus module. |
| Alt+F2 → `r` (X11), or log out and in (Wayland) | Reloads the Shell extension. JS changes have no effect until then. |

## Checks

```sh
node --check shell/action-wheel@diegolopes/*.js shell/action-wheel@diegolopes/actions/*.js
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell/Extensions/ActionWheel \
  --method org.gnome.Shell.Extensions.ActionWheel.Open "['file:///etc/hostname']"
journalctl -f -o cat /usr/bin/gnome-shell     # Shell errors
```

Shell-side code cannot run outside the Shell, because it imports `resource:///org/gnome/shell/...`. Test pure logic in `util.js` with `gjs -m`. Everything else needs a Shell restart and a manual test.

## Conventions

- Icons are Tabler Icons outline SVGs in `icons/` (MIT, see `icons/LICENSE`). They use `stroke="currentColor"` and are recolored in code.
- Image operations call ImageMagick `convert` and write a new file next to the original with `newPath`. Original files are never overwritten.
- Video operations call `ffmpeg -nostdin -loglevel error` with the same `newPath` rule.
- Do not block the Shell main loop. Use `run()` from `actions/shell.js` for commands.
- `TASK.md` is the progress log. Only claim something works if its proof is in the Log.
