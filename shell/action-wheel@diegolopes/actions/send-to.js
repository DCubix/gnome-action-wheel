import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const CONNECT_NAME = 'org.gnome.Shell.Extensions.ZorinConnect';

// Paired and connected Zorin Connect devices; [] if the service is not running.
// ponytail: sync D-Bus call in the Shell main loop, capped at 500 ms; make it async if it ever stalls.
function devices() {
    let objects;
    try {
        [objects] = Gio.DBus.session.call_sync(CONNECT_NAME, '/org/gnome/Shell/Extensions/ZorinConnect',
            'org.freedesktop.DBus.ObjectManager', 'GetManagedObjects', null, null,
            Gio.DBusCallFlags.NONE, 500, null).recursiveUnpack();
    } catch (e) {
        return [];
    }
    return Object.entries(objects)
        .map(([path, ifaces]) => [path, ifaces[`${CONNECT_NAME}.Device`]])
        .filter(([, device]) => device?.Connected && device.Paired)
        .map(([path, device]) => ({
            label: device.Name,
            gicon: new Gio.ThemedIcon({name: device.IconName}),
            // Same action call as Zorin Connect's own Nautilus plugin.
            run: uris => uris.forEach(uri => Gio.DBus.session.call(CONNECT_NAME, path, 'org.gtk.Actions', 'Activate',
                new GLib.Variant('(sava{sv})', ['shareFile', [new GLib.Variant('(sb)', [uri, false])], {}]),
                null, Gio.DBusCallFlags.NONE, -1, null, null)),
        }));
}

export default {
    label: 'Send to',
    icon: 'device-mobile-share',
    empty: 'No connected devices',
    children: devices,
};
