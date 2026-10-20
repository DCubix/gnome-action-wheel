// Trim window, started by the wheel as `gjs -m trim.js <path>`.
// Play or seek to a point, press Set start / Set end, then Save. ffmpeg writes the part as a new file next to the original.
// ponytail: stream copy cuts at the nearest keyframe, so the start can be off by up to one keyframe interval;
// re-encode with -c:v libx264 if exact cuts are needed.
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import System from 'system';

import {newPath} from './util.js';

const path = System.programArgs[0];

// Microseconds -> m:ss.s
function formatTime(us) {
    const s = us / 1e6;
    return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

function buildWindow(app) {
    if (!GLib.file_test(path, GLib.FileTest.EXISTS))
        throw new Error(`no such file: ${path}`);

    // Microseconds; end null means the end of the file.
    let start = 0, end = null;

    const video = new Gtk.Video({file: Gio.File.new_for_path(path), autoplay: false, vexpand: true});
    const now = () => video.get_media_stream()?.get_timestamp() ?? 0;

    const range = new Gtk.Label();
    const showRange = () => {
        range.label = `${formatTime(start)} – ${end === null ? 'end' : formatTime(end)}`;
    };
    showRange();

    const setStart = new Gtk.Button({label: 'Set start'});
    setStart.connect('clicked', () => {
        start = now();
        if (end !== null && end <= start)
            end = null;
        showRange();
    });
    const setEnd = new Gtk.Button({label: 'Set end'});
    setEnd.connect('clicked', () => {
        end = now();
        if (end <= start)
            start = 0;
        showRange();
    });

    const toasts = new Adw.ToastOverlay({child: video});
    const window = new Adw.ApplicationWindow({application: app, default_width: 900, default_height: 600});

    const save = new Gtk.Button({label: 'Save', css_classes: ['suggested-action']});
    save.connect('clicked', () => {
        const argv = ['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', `${start / 1e6}`];
        if (end !== null)
            argv.push('-to', `${end / 1e6}`);
        argv.push('-i', path, '-c', 'copy', newPath(path, '-trim'));
        save.sensitive = false;
        video.get_media_stream()?.pause();
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
    header.pack_start(setStart);
    header.pack_start(setEnd);
    header.pack_start(range);
    header.pack_end(save);

    const view = new Adw.ToolbarView({content: toasts});
    view.add_top_bar(header);
    window.content = view;
    window.present();
}

const app = new Adw.Application({
    application_id: 'io.github.diegolopes.ActionWheelTrim',
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
