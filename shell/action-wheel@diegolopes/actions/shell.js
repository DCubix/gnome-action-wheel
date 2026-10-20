// Shell-only helpers shared by actions. util.js is also loaded by the GTK editor, so these cannot go there.
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

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
