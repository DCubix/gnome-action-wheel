# Action Wheel

Shift + left-click on a file in Nautilus opens a radial action menu at the pointer. The menu is drawn by GNOME Shell.

Target: GNOME Shell 46, Nautilus 46.

## Actions

Clockwise from the top:

| Entry | Shown for | Does |
|-------|-----------|------|
| Open | all files | Opens with the default app. |
| Open With | all files | Lists the apps that can open the file. |
| Image | `image/*` | Convert (PNG, JPG, WEBP, AVIF, GIF, TIFF, BMP, ICO), Scale (75/50/25%), Edit (crop and rotate), Copy image. |
| Video | `video/*` | Convert (MP4, WEBM, MKV, MOV, GIF), Audio (MP3, OPUS, WAV), Scale, Compress, Trim. |
| Copy contents | `text/plain` | Copies the file's text to the clipboard. |
| Send to | all files | Sends the file to a Zorin Connect device. |
| Clipboard | all files | Copy or Cut the file. |
| Copy path | all files | Copies the file path. |

Image and video operations write a new file next to the original. The original is never overwritten.

## Requirements

| Package | Used for |
|---------|----------|
| `valac`, GTK 4 and `libnautilus-extension` development files | Building the Nautilus module |
| ImageMagick (`convert`) | Image actions |
| `ffmpeg` | Video actions |
| Zorin Connect | Send to (optional) |

## Install

```sh
./install.sh
gnome-extensions enable action-wheel@diegolopes
nautilus -q
```

`install.sh` builds `build/libnautilus-action-wheel.so`, installs it with sudo, and symlinks the Shell extension into `~/.local/share/gnome-shell/extensions/`. Run it in a terminal, because it asks for the sudo password. Use `./install.sh --build-only` to build without installing.

After installing or changing the JS code, restart the Shell: Alt+F2 → `r` on X11, or log out and in on Wayland.

## Release

```sh
./install.sh --dist
```

This writes two files to `dist/`. The version comes from `version-name` in `metadata.json`.

| File | Contents |
|------|----------|
| `action-wheel@diegolopes.shell-extension.zip` | The Shell extension. Install it with `gnome-extensions install`. |
| `gnome-action-wheel-<version>.tar.gz` | Full source. Users build and install it with `./install.sh`. |

The zip alone does nothing: the wheel opens only when the Nautilus module is installed too. The module is a compiled `.so`, so users must build it from source.

## Layout

| Path | Contents |
|------|----------|
| `nautilus/action-wheel.vala` | Nautilus module. Catches Shift+LMB, finds the file under the pointer, calls D-Bus `org.gnome.Shell.Extensions.ActionWheel.Open(as uris)`. |
| `shell/action-wheel@diegolopes/extension.js` | Shell extension. Exports the D-Bus method and draws the wheel. |
| `shell/action-wheel@diegolopes/actions/` | One file per wheel entry. `index.js` sets the order. |
| `shell/action-wheel@diegolopes/editor.js` | Crop and rotate window (GTK 4). |
| `shell/action-wheel@diegolopes/trim.js` | Video trim window (GTK 4). |
| `shell/action-wheel@diegolopes/icons/` | Tabler Icons outline SVGs (MIT). |

To add an action, see [`actions/README.md`](shell/action-wheel@diegolopes/actions/README.md).

## Test without Nautilus

```sh
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell/Extensions/ActionWheel \
  --method org.gnome.Shell.Extensions.ActionWheel.Open "['file:///etc/hostname']"
journalctl -f -o cat /usr/bin/gnome-shell
```

## License

MIT, see `LICENSE`. The icons are Tabler Icons, MIT, see `shell/action-wheel@diegolopes/icons/LICENSE`.
