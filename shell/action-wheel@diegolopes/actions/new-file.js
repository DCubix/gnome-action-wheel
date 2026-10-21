import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {newPath} from '../util.js';
import {askName, localPath} from './shell.js';

// create_async fails if the name is taken, so an existing file is never overwritten.
function create(dir, name) {
    Gio.File.new_for_path(GLib.build_filenamev([dir, name])).create_async(Gio.FileCreateFlags.NONE,
        GLib.PRIORITY_DEFAULT, null, (file, res) => {
            try {
                file.create_finish(res).close_async(GLib.PRIORITY_DEFAULT, null, null);
            } catch (e) {
                Main.notify('Action Wheel', e.message);
            }
        });
}

export default {
    label: 'New file',
    icon: 'file-plus',
    run: ([folder]) => {
        const dir = localPath(folder);
        askName('New file name', GLib.path_get_basename(newPath(`${dir}/New File.txt`, '')), name => create(dir, name));
    },
};
