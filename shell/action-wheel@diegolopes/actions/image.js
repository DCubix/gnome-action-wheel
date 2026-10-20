import Gio from 'gi://Gio';
import St from 'gi://St';

import {newPath} from '../util.js';
import {localPath, run} from './shell.js';

const EDITOR = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_child('editor.js').get_path();

// [label, extension, mime type of that format]
const FORMATS = [
    ['PNG', 'png', 'image/png'],
    ['JPG', 'jpg', 'image/jpeg'],
    ['WEBP', 'webp', 'image/webp'],
    ['AVIF', 'avif', 'image/avif'],
    ['GIF', 'gif', 'image/gif'],
    ['TIFF', 'tiff', 'image/tiff'],
    ['BMP', 'bmp', 'image/bmp'],
    ['ICO', 'ico', 'image/vnd.microsoft.icon'],
];

export default {
    label: 'Image',
    icon: 'photo',
    mimeTypes: ['image/*'],
    children: [
        {
            label: 'Convert',
            icon: 'file-export',
            children: FORMATS.map(([label, ext, mime]) => ({
                label,
                icon: 'file-export',
                hideFor: [mime],
                run: uris => uris.map(localPath).forEach(path => run(['convert', path, newPath(path, '', ext)])),
            })),
        },
        {
            label: 'Scale',
            icon: 'resize',
            children: [75, 50, 25].map(percent => ({
                label: `${percent}%`,
                icon: 'resize',
                run: uris => uris.map(localPath).forEach(path =>
                    run(['convert', path, '-resize', `${percent}%`, newPath(path, `-${percent}%`)])),
            })),
        },
        {
            label: 'Edit',
            icon: 'photo-edit',
            run: uris => uris.map(localPath).forEach(path => run(['gjs', '-m', EDITOR, path])),
        },
        {
            label: 'Copy image',
            icon: 'photo-down',
            // First file only; [0] takes the first frame of animated images.
            run: uris => run(['convert', `${localPath(uris[0])}[0]`, 'png:-'], png =>
                St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD, 'image/png', png)),
        },
    ],
};
