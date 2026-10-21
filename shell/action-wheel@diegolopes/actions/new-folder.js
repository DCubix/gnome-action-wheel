import GLib from 'gi://GLib';

import {newPath} from '../util.js';
import {askName, fileOperation, localPath} from './shell.js';

export default {
    label: 'New folder',
    icon: 'folder-plus',
    run: ([folder]) => askName('New folder name',
        GLib.path_get_basename(newPath(`${localPath(folder)}/New Folder`, '')),
        name => fileOperation('CreateFolder', 's', folder, 's', name)),
};
