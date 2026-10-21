import Gio from 'gi://Gio';

import {localPath} from './shell.js';

// Not run() from shell.js: the terminal keeps running, and its output is not needed.
function openTerminal([folder]) {
    const exec = new Gio.Settings({schema_id: 'org.gnome.desktop.default-applications.terminal'}).get_string('exec');
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.set_cwd(localPath(folder));
    launcher.spawnv([exec]);
}

export default {
    label: 'Terminal',
    icon: 'terminal-2',
    run: openTerminal,
};
