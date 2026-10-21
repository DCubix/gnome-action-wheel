// The wheel's top page, in this order clockwise from the top. One file per action.
//
// An entry is {label, icon, run} for an action, or {label, icon, children} for a sub-menu.
// `run(uris)` gets the selected file URIs.
// `icon` is a Tabler Icons outline SVG in icons/ (name without .svg). Entries built at runtime use `gicon` (a Gio.Icon) instead.
// `children` can be a function (uris, types) => entries, called when the sub-menu is opened;
// if it returns no entries, the wheel closes and shows `empty` in a notification.
// Optional `mimeTypes` (e.g. ['image/*', 'text/plain']): the entry is shown only if every file matches one of them.
// Optional `hideFor`: the entry is hidden if every file matches one of them.
//
// To add an action: create actions/<name>.js with `export default {label, icon, run}`,
// put its SVG in icons/, and add it to the list below. Full guide: README.md in this folder.
import clipboard from './clipboard.js';
import copyContents from './copy-contents.js';
import copyPath from './copy-path.js';
import image from './image.js';
import newFile from './new-file.js';
import newFolder from './new-folder.js';
import open from './open.js';
import openWith from './open-with.js';
import paste from './paste.js';
import sendTo from './send-to.js';
import terminal from './terminal.js';
import video from './video.js';

export default [open, openWith, image, video, copyContents, sendTo, clipboard, copyPath];

// The folder wheel, shown on Shift+LMB on empty space in a folder. `run(uris)` gets [folderUri].
export const FOLDER_ACTIONS = [newFolder, newFile, paste, terminal];
