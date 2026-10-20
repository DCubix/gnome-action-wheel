# Adding an action

Each top-level entry on the wheel is one file in this folder. `index.js` lists them in wheel order, clockwise from the top.

## Steps

1. Create `actions/<name>.js` that default-exports one entry:
   ```js
   import Gio from 'gi://Gio';

   export default {
       label: 'Open',
       icon: 'external-link',
       run: uris => uris.forEach(uri => Gio.AppInfo.launch_default_for_uri(uri, null)),
   };
   ```
2. Put the icon in `../icons/<icon>.svg`. Use a Tabler Icons outline SVG (https://tabler.io/icons, `stroke="currentColor"`). The wheel recolors it to the theme text color.
3. Import the file in `index.js` and add it to the exported list where it should appear.
4. Restart the Shell (Alt+F2 → r on X11, log out and in on Wayland). GNOME Shell does not reload extension modules without a restart.

## Entry fields

| Field | Type | Meaning |
|-------|------|---------|
| `label` | string | Text under the icon. Required. |
| `icon` | string | File name in `icons/` without `.svg`. |
| `gicon` | `Gio.Icon` | Used instead of `icon` for entries built at runtime (app icons, device icons). |
| `run` | `uris => void` | Called with the selected file URIs after the wheel closes. |
| `children` | entries, or `(uris, types) => entries` | Makes the entry a sub-menu. A function is called when the sub-menu opens. `types` are the files' content types. |
| `empty` | string | Notification shown when `children()` returns no entries. |
| `mimeTypes` | string[] | Show the entry only if every file matches one pattern, e.g. `['image/*', 'text/plain']`. |
| `hideFor` | string[] | Hide the entry if every file matches one pattern. |

An entry has either `run` or `children`, not both. A sub-menu whose fixed `children` are all hidden is hidden too. A Back button is added to every sub-page automatically.

Mime patterns: `type/*` matches by prefix. Any other value uses `Gio.content_type_is_a`, so `text/plain` also matches `text/x-python`.

## Helpers

| Helper | From | Use |
|--------|------|-----|
| `run(argv, onDone)` | `./shell.js` | Runs a command without blocking the Shell. On failure it shows stderr in a notification. `onDone` gets stdout as `GLib.Bytes`. |
| `localPath(uri)` | `./shell.js` | URI to a local path. Throws for non-local files. |
| `newPath(path, suffix, ext)` | `../util.js` | Free file name next to `path`: `photo<suffix>.<ext>`, then `photo<suffix> (2).<ext>` and so on. |

Rules for action code:
- It runs inside GNOME Shell. A blocking call freezes the whole desktop. Use `run()` or async APIs for anything slow.
- An exception thrown in `run` or `children` is caught and logged. To see it, run `journalctl -f -o cat /usr/bin/gnome-shell`.
- Do not import GTK. For a window, start a separate GJS process the way `image.js` starts `../editor.js`.

## Sub-menu example

```js
export default {
    label: 'Scale',
    icon: 'resize',
    mimeTypes: ['image/*'],
    children: [75, 50, 25].map(percent => ({
        label: `${percent}%`,
        icon: 'resize',
        run: uris => uris.map(localPath).forEach(path =>
            run(['convert', path, '-resize', `${percent}%`, newPath(path, `-${percent}%`)])),
    })),
};
```

`open-with.js` and `send-to.js` show sub-menus built when they open.
