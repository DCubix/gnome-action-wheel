import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import ACTIONS, {FOLDER_ACTIONS} from './actions/index.js';

const DBUS_PATH = '/org/gnome/Shell/Extensions/ActionWheel';
const DBUS_IFACE = `
<node>
  <interface name="org.gnome.Shell.Extensions.ActionWheel">
    <method name="Open">
      <arg type="as" direction="in" name="uris"/>
    </method>
    <method name="OpenFolder">
      <arg type="s" direction="in" name="uri"/>
    </method>
  </interface>
</node>`;

const RADIUS = 80;
const BUTTON_SIZE = 76;
const ICON_SIZE = 24;
const HOVER_SCALE = 1.12;

// Put in the first slot of every sub-page.
const BACK = {label: 'Back', icon: 'arrow-back-up'};

function iconNames(entries) {
    return entries.flatMap(e => [e.icon, ...iconNames(Array.isArray(e.children) ? e.children : [])]);
}

// ponytail: sync query in the Shell main loop; fine for local files, switch to query_info_async if remote files stall the Shell.
function contentTypeOf(uri) {
    try {
        return Gio.File.new_for_uri(uri).query_info('standard::content-type', Gio.FileQueryInfoFlags.NONE, null)
            .get_content_type();
    } catch (e) {
        return 'application/octet-stream';
    }
}

// content_type_is_a also matches subtypes, e.g. text/x-python is a text/plain.
function matches(type, pattern) {
    return pattern.endsWith('/*') ? type.startsWith(pattern.slice(0, -1)) : Gio.content_type_is_a(type, pattern);
}

// A sub-menu with no visible children is hidden. Function children are only known on open, so they count as visible.
function isVisible(entry, types) {
    if (entry.mimeTypes && !types.every(t => entry.mimeTypes.some(p => matches(t, p))))
        return false;
    if (entry.hideFor && types.every(t => entry.hideFor.some(p => matches(t, p))))
        return false;
    return !Array.isArray(entry.children) || entry.children.some(c => isVisible(c, types));
}

// Offset of button i of n from the wheel center. The radius grows so that many buttons do not overlap.
function offsetOf(i, n) {
    const radius = Math.max(RADIUS, n * BUTTON_SIZE * 1.15 / (2 * Math.PI));
    const angle = 2 * Math.PI * i / n - Math.PI / 2;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

// Tabler SVGs draw with stroke="currentColor". St's symbolic recoloring sets fill instead,
// so the color is written into the SVG text.
function tablerIcon(svg, color) {
    const css = `rgba(${color.red},${color.green},${color.blue},${color.alpha / 255})`;
    return Gio.BytesIcon.new(new GLib.Bytes(new TextEncoder().encode(svg.replaceAll('currentColor', css))));
}

export default class ActionWheelExtension extends Extension {
    enable() {
        const iconDir = this.dir.get_child('icons');
        this._svgs = {};
        for (const icon of new Set([BACK.icon, ...iconNames([...ACTIONS, ...FOLDER_ACTIONS])].filter(Boolean))) {
            const [, contents] = iconDir.get_child(`${icon}.svg`).load_contents(null);
            this._svgs[icon] = new TextDecoder().decode(contents);
        }

        this._dbus = Gio.DBusExportedObject.wrapJSObject(DBUS_IFACE, this);
        this._dbus.export(Gio.DBus.session, DBUS_PATH);
    }

    disable() {
        this._close(false);
        this._dbus.unexport();
        this._dbus = null;
        this._svgs = null;
    }

    Open(uris) {
        this._open(uris, ACTIONS);
    }

    // Shift+LMB on empty space in a folder: the folder wheel, with the folder as the only URI.
    OpenFolder(uri) {
        this._open([uri], FOLDER_ACTIONS);
    }

    _open(uris, entries) {
        this._close();
        [this._px, this._py] = global.get_pointer();
        this._uris = uris;
        this._types = uris.map(contentTypeOf);
        // Entries of the parent pages, closest parent last.
        this._pages = [];

        const backdrop = new St.Widget({
            reactive: true,
            x: 0,
            y: 0,
            width: global.stage.width,
            height: global.stage.height,
        });
        backdrop.connect('button-press-event', () => {
            this._close();
            return Clutter.EVENT_STOP;
        });
        backdrop.connect('key-press-event', (_actor, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape)
                this._close();
            return Clutter.EVENT_STOP;
        });

        Main.layoutManager.uiGroup.add_child(backdrop);
        this._backdrop = backdrop;
        this._grab = Main.pushModal(backdrop);
        this._showPage(entries);
    }

    _showPage(entries) {
        this._entries = entries;
        const items = entries.filter(e => isVisible(e, this._types));
        if (this._pages.length > 0)
            items.unshift(BACK);
        const buttons = items.map((entry, i) => this._createButton(entry, i, items.length));
        buttons.forEach(button => this._backdrop.add_child(button));
        this._animateIn(buttons);
    }

    // The current buttons shrink into the center, then the new page grows out of it.
    _swapPage(entries) {
        const backdrop = this._backdrop;
        this._animateOut(backdrop.get_children(), () => {
            if (this._backdrop !== backdrop)
                return;
            backdrop.destroy_all_children();
            this._showPage(entries);
        });
    }

    _createButton(entry, i, n) {
        const [dx, dy] = offsetOf(i, n);
        const icon = new St.Icon({icon_size: ICON_SIZE});
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'action-wheel-content',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(icon);
        box.add_child(new St.Label({
            text: entry.label,
            style_class: 'action-wheel-label',
            x_align: Clutter.ActorAlign.CENTER,
        }));

        // track_hover stays off: the theme's .button.default:hover is a darker shade,
        // and the hover state should show the plain accent color of .button.default.
        const button = new St.Button({
            child: box,
            style_class: 'button action-wheel-button',
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            x: this._px + dx - BUTTON_SIZE / 2,
            y: this._py + dy - BUTTON_SIZE / 2,
            pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
            translation_x: -dx,
            translation_y: -dy,
            scale_x: 0.4,
            scale_y: 0.4,
            opacity: 0,
        });
        // Read back by _animateOut to shrink the button toward the center.
        button._offset = [dx, dy];

        // The text color changes with the `default` class, so the Tabler icon is recolored to match.
        if (entry.gicon) {
            icon.gicon = entry.gicon;
        } else {
            const svg = this._svgs[entry.icon];
            button.connect('style-changed', () => {
                icon.gicon = tablerIcon(svg, button.get_theme_node().get_foreground_color());
            });
        }

        const setHover = hover => {
            if (hover)
                button.add_style_class_name('default');
            else
                button.remove_style_class_name('default');
            const scale = hover ? HOVER_SCALE : 1;
            button.ease({
                scale_x: scale,
                scale_y: scale,
                duration: 120,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        };
        button.connect('enter-event', () => {
            setHover(true);
            return Clutter.EVENT_PROPAGATE;
        });
        button.connect('leave-event', () => {
            setHover(false);
            return Clutter.EVENT_PROPAGATE;
        });

        button.connect('clicked', () => {
            if (entry === BACK) {
                this._swapPage(this._pages.pop());
            } else if (entry.children) {
                let children = entry.children;
                try {
                    if (typeof children === 'function')
                        children = children(this._uris, this._types);
                } catch (e) {
                    logError(e, `action-wheel: ${entry.label}`);
                    children = [];
                }
                if (children.length === 0) {
                    this._close();
                    Main.notify('Action Wheel', entry.empty ?? `${entry.label}: nothing to show`);
                    return;
                }
                this._pages.push(this._entries);
                this._swapPage(children);
            } else {
                this._close();
                try {
                    entry.run(this._uris);
                } catch (e) {
                    logError(e, `action-wheel: ${entry.label}`);
                }
            }
        });
        return button;
    }

    // Grow each button out of the center, one after another.
    // Opacity gets its own non-overshooting ease: EASE_OUT_BACK goes past 255, and the
    // 8-bit opacity wraps to near 0, which shows as a flash.
    _animateIn(buttons) {
        buttons.forEach((button, i) => {
            button.ease({
                translation_x: 0,
                translation_y: 0,
                scale_x: 1,
                scale_y: 1,
                duration: 220,
                delay: i * 30,
                mode: Clutter.AnimationMode.EASE_OUT_BACK,
            });
            button.ease({
                opacity: 255,
                duration: 220,
                delay: i * 30,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        });
    }

    // Buttons stop taking input at once, shrink into the center, then onDone runs.
    _animateOut(buttons, onDone) {
        if (buttons.length === 0) {
            onDone();
            return;
        }
        buttons.forEach(button => (button.reactive = false));
        buttons.forEach((button, i) => {
            const [dx, dy] = button._offset;
            button.ease({
                translation_x: -dx,
                translation_y: -dy,
                scale_x: 0.4,
                scale_y: 0.4,
                opacity: 0,
                duration: 150,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onStopped: i === buttons.length - 1 ? onDone : undefined,
            });
        });
    }

    // Input goes back to the desktop at once; the buttons then shrink into the center.
    _close(animate = true) {
        if (this._grab)
            Main.popModal(this._grab);
        this._grab = null;
        const backdrop = this._backdrop;
        this._backdrop = null;
        if (!backdrop)
            return;
        if (!animate) {
            backdrop.destroy();
            return;
        }

        backdrop.reactive = false;
        this._animateOut(backdrop.get_children(), () => backdrop.destroy());
    }
}
