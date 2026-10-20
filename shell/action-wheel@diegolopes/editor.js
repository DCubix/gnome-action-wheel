// Crop and rotate editor, started by the wheel as `gjs -m editor.js <path>`.
// The result is written by ImageMagick as a new file next to the original.
// ponytail: no undo, free-form crop only, no aspect presets.
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import System from 'system';

import {dragCrop, fit, hitCrop, newPath, toImage} from './util.js';

const path = System.programArgs[0];
// Grab distance around the crop edges and the drawn handle size, in widget pixels.
const HANDLE = 10;
const HANDLE_SIZE = 8;

// Pointer cursor for what hitCrop returns.
function cursorFor(grab) {
    if (grab === 'move')
        return 'move';
    if (!grab)
        return 'crosshair';
    if ((grab.l && grab.t) || (grab.r && grab.b))
        return 'nwse-resize';
    if ((grab.l && grab.b) || (grab.r && grab.t))
        return 'nesw-resize';
    return grab.l || grab.r ? 'ew-resize' : 'ns-resize';
}

// Preview is loaded through ImageMagick so every format it reads works. -auto-orient matches the saved result.
function loadPreview() {
    const proc = Gio.Subprocess.new(['convert', `${path}[0]`, '-auto-orient', 'png:-'],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const [, stdout, stderr] = proc.communicate(null, null);
    if (!proc.get_successful())
        throw new Error(new TextDecoder().decode(stderr.toArray()));
    return GdkPixbuf.Pixbuf.new_from_stream(Gio.MemoryInputStream.new_from_bytes(stdout), null);
}

function buildWindow(app) {
    let pixbuf = loadPreview();
    // Clockwise degrees, the same direction as ImageMagick's -rotate.
    let degrees = 0;
    // In pixels of the rotated image: {x, y, w, h}, or null for no crop.
    let crop = null;

    const area = new Gtk.DrawingArea({hexpand: true, vexpand: true});
    const layout = () => fit(area.get_width(), area.get_height(), pixbuf.width, pixbuf.height);
    // The crop rectangle in widget pixels.
    const cropOnScreen = f => ({x: f.x + crop.x * f.scale, y: f.y + crop.y * f.scale, w: crop.w * f.scale, h: crop.h * f.scale});
    const grabAt = (x, y) => (crop ? hitCrop(x, y, cropOnScreen(layout()), HANDLE) : null);

    area.set_draw_func((_area, cr, w, h) => {
        const f = layout();
        cr.save();
        cr.translate(f.x, f.y);
        cr.scale(f.scale, f.scale);
        Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
        cr.paint();
        cr.restore();
        if (crop) {
            const {x, y, w: cw, h: ch} = cropOnScreen(f);
            // Dim everything outside the crop rectangle.
            cr.setSourceRGBA(0, 0, 0, 0.5);
            cr.rectangle(0, 0, w, h);
            cr.rectangle(x + cw, y, -cw, ch);
            cr.fill();
            cr.setSourceRGBA(1, 1, 1, 1);
            cr.setLineWidth(2);
            cr.rectangle(x, y, cw, ch);
            cr.stroke();
            // Handles on the corners and edge midpoints.
            for (const hx of [x, x + cw / 2, x + cw]) {
                for (const hy of [y, y + ch / 2, y + ch]) {
                    if (hx !== x + cw / 2 || hy !== y + ch / 2)
                        cr.rectangle(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                }
            }
            cr.fillPreserve();
            cr.setSourceRGBA(0, 0, 0, 0.6);
            cr.setLineWidth(1);
            cr.stroke();
        }
        cr.$dispose();
    });

    const motion = new Gtk.EventControllerMotion();
    motion.connect('motion', (_c, x, y) => area.set_cursor_from_name(cursorFor(grabAt(x, y))));
    area.add_controller(motion);

    // A press on an edge or corner resizes the crop, inside it moves the crop, outside it starts a new one.
    const drag = new Gtk.GestureDrag();
    let start, grab, startCrop;
    drag.connect('drag-begin', (_g, x, y) => {
        start = [x, y];
        grab = grabAt(x, y);
        startCrop = crop;
        if (!grab)
            crop = null;
        area.queue_draw();
    });
    drag.connect('drag-update', (_g, dx, dy) => {
        const f = layout();
        if (grab) {
            crop = dragCrop(startCrop, grab, dx / f.scale, dy / f.scale, pixbuf.width, pixbuf.height);
        } else {
            const [x1, y1] = toImage(start[0], start[1], f, pixbuf.width, pixbuf.height);
            const [x2, y2] = toImage(start[0] + dx, start[1] + dy, f, pixbuf.width, pixbuf.height);
            crop = {x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)};
        }
        area.queue_draw();
    });
    // A click outside the crop clears it; a crop squeezed below 2 px is dropped.
    drag.connect('drag-end', () => {
        if (crop && (crop.w < 2 || crop.h < 2))
            crop = null;
        area.queue_draw();
    });
    area.add_controller(drag);

    const rotate = (rotation, delta) => {
        pixbuf = pixbuf.rotate_simple(rotation);
        degrees = (degrees + delta) % 360;
        crop = null;
        area.queue_draw();
    };
    const left = new Gtk.Button({icon_name: 'object-rotate-left-symbolic', tooltip_text: 'Rotate left'});
    left.connect('clicked', () => rotate(GdkPixbuf.PixbufRotation.COUNTERCLOCKWISE, 270));
    const right = new Gtk.Button({icon_name: 'object-rotate-right-symbolic', tooltip_text: 'Rotate right'});
    right.connect('clicked', () => rotate(GdkPixbuf.PixbufRotation.CLOCKWISE, 90));

    const toasts = new Adw.ToastOverlay({child: area});
    const window = new Adw.ApplicationWindow({application: app, default_width: 900, default_height: 700});

    const save = new Gtk.Button({label: 'Save', css_classes: ['suggested-action']});
    save.connect('clicked', () => {
        const argv = ['convert', path, '-auto-orient'];
        if (degrees)
            argv.push('-rotate', `${degrees}`);
        if (crop)
            argv.push('-crop', `${crop.w}x${crop.h}+${crop.x}+${crop.y}`, '+repage');
        argv.push(newPath(path, '-edited'));
        save.sensitive = false;
        const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDERR_PIPE);
        proc.communicate_async(null, null, (_p, res) => {
            const [, , stderr] = proc.communicate_finish(res);
            if (proc.get_successful()) {
                window.close();
                return;
            }
            save.sensitive = true;
            toasts.add_toast(new Adw.Toast({title: new TextDecoder().decode(stderr.toArray()).trim(), timeout: 0}));
        });
    });

    const header = new Adw.HeaderBar({title_widget: new Adw.WindowTitle({title: GLib.path_get_basename(path)})});
    header.pack_start(left);
    header.pack_start(right);
    header.pack_end(save);

    const view = new Adw.ToolbarView({content: toasts});
    view.add_top_bar(header);
    window.content = view;
    window.present();
}

const app = new Adw.Application({
    application_id: 'io.github.diegolopes.ActionWheelEditor',
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});
// The wheel shows stderr of a failed run in a notification.
app.connect('activate', () => {
    try {
        buildWindow(app);
    } catch (e) {
        printerr(e.message);
        System.exit(1);
    }
});
app.run([System.programInvocationName]);
