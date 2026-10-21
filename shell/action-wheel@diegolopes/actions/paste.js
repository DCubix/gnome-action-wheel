import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {fileOperation} from './shell.js';

// Reads the clipboard format Nautilus and clipboard.js write: "copy" or "cut", then one URI per line.
function paste([folder]) {
    St.Clipboard.get_default().get_content(St.ClipboardType.CLIPBOARD, 'x-special/gnome-copied-files', (_c, bytes) => {
        const [op, ...uris] = bytes?.get_size() ? new TextDecoder().decode(bytes.toArray()).split('\n').filter(Boolean) : [];
        if (uris.length === 0 || (op !== 'copy' && op !== 'cut')) {
            Main.notify('Action Wheel', 'Clipboard has no files');
            return;
        }
        fileOperation(op === 'cut' ? 'MoveURIs' : 'CopyURIs', 'as', uris, 's', folder);
    });
}

export default {
    label: 'Paste',
    icon: 'clipboard-plus',
    run: paste,
};
