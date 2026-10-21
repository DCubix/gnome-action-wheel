// Shell-only helpers shared by actions. util.js is also loaded by the GTK editor, so these cannot go there.
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

// Runs argv without blocking the Shell. On failure stderr is shown in a notification;
// on success onDone gets stdout as GLib.Bytes.
export function run(argv, onDone = () => {}) {
    const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    proc.communicate_async(null, null, (_p, res) => {
        try {
            const [, stdout, stderr] = proc.communicate_finish(res);
            if (proc.get_successful())
                onDone(stdout);
            else
                Main.notify('Action Wheel', new TextDecoder().decode(stderr.toArray()).trim() || `${argv[0]} failed`);
        } catch (e) {
            logError(e, `action-wheel: ${argv[0]}`);
        }
    });
}

// ImageMagick and the editor need local paths.
export function localPath(uri) {
    const path = Gio.File.new_for_uri(uri).get_path();
    if (!path)
        throw new Error(`not a local file: ${uri}`);
    return path;
}

// Calls org.gnome.Nautilus.FileOperations2, so Nautilus shows progress, asks about name conflicts, and records Undo.
// `args` are the method's arguments without the trailing platform_data, e.g. ['as', uris, 's', folderUri].
export function fileOperation(method, ...args) {
    const types = args.filter((_, i) => i % 2 === 0).join('');
    const values = args.filter((_, i) => i % 2 === 1);
    Gio.DBus.session.call('org.gnome.Nautilus', '/org/gnome/Nautilus/FileOperations2',
        'org.gnome.Nautilus.FileOperations2', method,
        new GLib.Variant(`(${types}a{sv})`, [...values, {}]),
        null, Gio.DBusCallFlags.NONE, -1, null, (bus, res) => {
            try {
                bus.call_finish(res);
            } catch (e) {
                Main.notify('Action Wheel', `${method}: ${e.message}`);
            }
        });
}

// Asks for a file or folder name. `name` is the start text; the part before the last dot is preselected.
// onName gets the trimmed name; an empty name or one with '/' shows a notification instead.
export function askName(title, name, onName) {
    const dialog = new ModalDialog.ModalDialog();
    const entry = new St.Entry({text: name, can_focus: true, x_expand: true});
    dialog.contentLayout.add_child(new St.Label({text: title}));
    dialog.contentLayout.add_child(entry);

    const done = () => {
        dialog.close();
        const text = entry.text.trim();
        if (!text || text.includes('/'))
            Main.notify('Action Wheel', `Invalid name: "${text}"`);
        else
            onName(text);
    };
    entry.clutter_text.connect('activate', done);
    dialog.setButtons([
        {label: 'Cancel', action: () => dialog.close(), key: Clutter.KEY_Escape},
        {label: 'Create', action: done, default: true},
    ]);
    dialog.setInitialKeyFocus(entry);
    dialog.open();
    const dot = name.lastIndexOf('.');
    entry.clutter_text.set_selection(0, dot > 0 ? dot : name.length);
}
