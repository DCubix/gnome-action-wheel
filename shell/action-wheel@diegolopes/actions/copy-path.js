import Gio from 'gi://Gio';
import St from 'gi://St';

export default {
    label: 'Copy path',
    icon: 'link',
    run: uris => St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD,
        uris.map(uri => Gio.File.new_for_uri(uri).get_path() ?? uri).join('\n')),
};
