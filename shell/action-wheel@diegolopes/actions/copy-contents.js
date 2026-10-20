import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Reads every file without blocking the Shell, then puts the texts on the clipboard in selection order.
function copyContents(uris) {
    const texts = [];
    let left = uris.length;
    uris.forEach((uri, i) => Gio.File.new_for_uri(uri).load_contents_async(null, (file, res) => {
        try {
            texts[i] = new TextDecoder().decode(file.load_contents_finish(res)[1]);
        } catch (e) {
            Main.notify('Action Wheel', e.message);
        }
        if (--left === 0)
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, texts.filter(t => t !== undefined).join('\n'));
    }));
}

export default {
    label: 'Copy contents',
    icon: 'clipboard-text',
    // text/plain matches by content_type_is_a, so it also covers text/markdown, text/x-python, application/json.
    mimeTypes: ['text/plain'],
    run: copyContents,
};
