import Gio from 'gi://Gio';

export default {
    label: 'Open',
    icon: 'external-link',
    run: uris => uris.forEach(uri => Gio.AppInfo.launch_default_for_uri(uri, null)),
};
