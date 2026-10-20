// Shared by extension.js (Shell) and editor.js (GTK), so it imports only GLib.
import GLib from 'gi://GLib';

// Path for a new file next to `path`: photo.jpg -> photo<suffix>.<ext>, then "photo<suffix> (2).<ext>" and so on
// until the name is free. `ext` defaults to the original extension.
export function newPath(path, suffix, ext) {
    const dot = path.lastIndexOf('.');
    const hasExt = dot > path.lastIndexOf('/');
    const base = hasExt ? path.slice(0, dot) : path;
    ext ??= hasExt ? path.slice(dot + 1) : '';
    const tail = ext ? `.${ext}` : '';
    let out = `${base}${suffix}${tail}`;
    for (let i = 2; GLib.file_test(out, GLib.FileTest.EXISTS); i++)
        out = `${base}${suffix} (${i})${tail}`;
    return out;
}

// Scale and offset that fit an iw x ih image centered in a w x h area.
export function fit(w, h, iw, ih) {
    const scale = Math.min(w / iw, h / ih);
    return {scale, x: (w - iw * scale) / 2, y: (h - ih * scale) / 2};
}

// Widget point -> image pixel, clamped to the image.
export function toImage(x, y, f, iw, ih) {
    const clamp = (v, max) => Math.round(Math.min(Math.max(v, 0), max));
    return [clamp((x - f.x) / f.scale, iw), clamp((y - f.y) / f.scale, ih)];
}

// What a press at (x, y) grabs on crop rectangle r ({x, y, w, h}, same units as the point):
// {l, r, t, b} for the edges within `tol` (two edges = a corner), 'move' inside, null outside.
export function hitCrop(x, y, r, tol) {
    const [x1, y1, x2, y2] = [r.x, r.y, r.x + r.w, r.y + r.h];
    const inX = x >= x1 - tol && x <= x2 + tol;
    const inY = y >= y1 - tol && y <= y2 + tol;
    const edges = {
        l: inY && Math.abs(x - x1) <= tol,
        r: inY && Math.abs(x - x2) <= tol,
        t: inX && Math.abs(y - y1) <= tol,
        b: inX && Math.abs(y - y2) <= tol,
    };
    // On a small crop both opposite edges can be in range; keep the closer one.
    if (edges.l && edges.r)
        edges[Math.abs(x - x1) < Math.abs(x - x2) ? 'r' : 'l'] = false;
    if (edges.t && edges.b)
        edges[Math.abs(y - y1) < Math.abs(y - y2) ? 'b' : 't'] = false;
    if (edges.l || edges.r || edges.t || edges.b)
        return edges;
    return x > x1 && x < x2 && y > y1 && y < y2 ? 'move' : null;
}

// Crop after dragging `grab` (from hitCrop) by (dx, dy) image pixels, kept inside the iw x ih image.
// Dragging an edge past the opposite one flips the rectangle.
export function dragCrop(c, grab, dx, dy, iw, ih) {
    const clamp = (v, max) => Math.round(Math.min(Math.max(v, 0), max));
    if (grab === 'move')
        return {x: clamp(c.x + dx, iw - c.w), y: clamp(c.y + dy, ih - c.h), w: c.w, h: c.h};
    const x1 = clamp(c.x + (grab.l ? dx : 0), iw), x2 = clamp(c.x + c.w + (grab.r ? dx : 0), iw);
    const y1 = clamp(c.y + (grab.t ? dy : 0), ih), y2 = clamp(c.y + c.h + (grab.b ? dy : 0), ih);
    return {x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)};
}
