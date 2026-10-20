import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {newPath} from '../util.js';
import {localPath, run} from './shell.js';

const TRIM = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_child('trim.js').get_path();

const GIF_FILTER = 'fps=12,scale=480:-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse';

// [label, extension, mime type of that format, ffmpeg output options]
const FORMATS = [
    ['MP4', 'mp4', 'video/mp4', ['-c:v', 'libx264', '-crf', '23', '-c:a', 'aac']],
    ['WEBM', 'webm', 'video/webm', ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus']],
    ['MKV', 'mkv', 'video/x-matroska', ['-c', 'copy']],
    ['MOV', 'mov', 'video/quicktime', ['-c:v', 'libx264', '-crf', '23', '-c:a', 'aac']],
    ['GIF', 'gif', 'image/gif', ['-vf', GIF_FILTER]],
];

// [label, extension, ffmpeg output options]
const AUDIO = [
    ['MP3', 'mp3', ['-c:a', 'libmp3lame', '-q:a', '2']],
    ['OPUS', 'opus', ['-c:a', 'libopus', '-b:a', '128k']],
    ['WAV', 'wav', []],
];

// Runs ffmpeg on every selected file. Video jobs can take minutes, so success is notified too.
function ffmpeg(uris, options, suffix, ext) {
    for (const path of uris.map(localPath)) {
        const out = newPath(path, suffix, ext);
        run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', path, ...options, out],
            () => Main.notify('Action Wheel', `Saved ${GLib.path_get_basename(out)}`));
    }
}

export default {
    label: 'Video',
    icon: 'movie',
    mimeTypes: ['video/*'],
    children: [
        {
            label: 'Convert',
            icon: 'file-export',
            children: FORMATS.map(([label, ext, mime, options]) => ({
                label,
                icon: 'file-export',
                hideFor: [mime],
                run: uris => ffmpeg(uris, options, '', ext),
            })),
        },
        {
            label: 'Audio',
            icon: 'music',
            children: AUDIO.map(([label, ext, options]) => ({
                label,
                icon: 'music',
                run: uris => ffmpeg(uris, ['-vn', ...options], '', ext),
            })),
        },
        {
            label: 'Scale',
            icon: 'resize',
            // min() keeps smaller videos at their size. The container's default encoder is used.
            children: [1080, 720, 480, 360, 144].map(height => ({
                label: `${height}p`,
                icon: 'resize',
                run: uris => ffmpeg(uris, ['-vf', `scale=-2:min(${height}\\,ih)`, '-c:a', 'copy'], `-${height}p`),
            })),
        },
        {
            label: 'Compress',
            icon: 'arrows-minimize',
            run: uris => ffmpeg(uris,
                ['-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-c:a', 'aac', '-b:a', '128k'], '-compressed', 'mp4'),
        },
        {
            label: 'Trim',
            icon: 'scissors',
            run: uris => uris.map(localPath).forEach(path => run(['gjs', '-m', TRIM, path])),
        },
    ],
};
