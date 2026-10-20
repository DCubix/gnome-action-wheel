import GLib from 'gi://GLib';
import St from 'gi://St';

// Same clipboard format Nautilus writes, so Ctrl+V in Nautilus pastes (op 'copy') or moves (op 'cut') the files.
function setClipboardFiles(op, uris) {
    St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD,
        'x-special/gnome-copied-files',
        new GLib.Bytes(new TextEncoder().encode([op, ...uris].join('\n'))));
}

export default {
    label: 'Clipboard',
    icon: 'clipboard',
    children: [
        {label: 'Copy', icon: 'copy', run: uris => setClipboardFiles('copy', uris)},
        {label: 'Cut', icon: 'scissors', run: uris => setClipboardFiles('cut', uris)},
    ],
};
