// Nautilus extension: Shift+LMB on a file sends its URI to the Action Wheel Shell extension.
// Shift+LMB on empty space in a folder view sends the folder URI instead.

[CCode (cname = "nautilus_file_info_get_uri")]
extern string file_info_get_uri (Object file_info);

// GtkGestureClick is final, so per-gesture state lives in object data and the handlers take the gesture as sender.
void on_pressed (Gtk.GestureClick click, int n_press, double x, double y) {
    click.steal_data<string> ("uri");
    if (!(Gdk.ModifierType.SHIFT_MASK in click.get_current_event_state ()))
        return;
    var method = "Open";
    var uri = uri_at (click.get_widget (), x, y);
    if (uri == null) {
        method = "OpenFolder";
        uri = folder_at (click.get_widget (), x, y);
    }
    if (uri == null)
        return;
    click.set_state (Gtk.EventSequenceState.CLAIMED);
    click.set_data<string> ("uri", uri);
    click.set_data<string> ("method", method);
}

// Sent on release so the X11 implicit pointer grab is gone when the Shell grabs the pointer.
void on_released (Gtk.GestureClick click, int n_press, double x, double y) {
    var uri = click.steal_data<string> ("uri");
    if (uri != null)
        open_wheel.begin (click.get_data<string> ("method"), uri);
}

bool has_object_property (Object obj, string name) {
    var pspec = ((ObjectClass) obj.get_type ().class_peek ()).find_property (name);
    return pspec != null && pspec.value_type.is_a (typeof (Object));
}

// Nautilus internals: view cells have an "item" property, the item has a "file" property (a NautilusFile).
string? uri_at (Gtk.Widget root, double x, double y) {
    for (var widget = root.pick (x, y, Gtk.PickFlags.DEFAULT); widget != null; widget = widget.get_parent ()) {
        if (!has_object_property (widget, "item"))
            continue;
        Object? item = null;
        widget.get ("item", out item);
        if (item == null || !has_object_property (item, "file"))
            return null;
        Object? file = null;
        item.get ("file", out file);
        return file != null ? file_info_get_uri (file) : null;
    }
    return null;
}

// Empty space inside a NautilusFilesView: the URI of the folder shown, from the "location" (GFile) of the
// NautilusWindowSlot above it. Null for file cells, scrollbars, the sidebar and the header, and for folders
// with no local path (Search, Recent, Trash, remote), because the folder actions need a local folder.
string? folder_at (Gtk.Widget root, double x, double y) {
    var files_view = Type.from_name ("NautilusFilesView");
    if (files_view == 0)
        return null;
    var in_view = false;
    for (var widget = root.pick (x, y, Gtk.PickFlags.DEFAULT); widget != null; widget = widget.get_parent ()) {
        if (widget is Gtk.Scrollbar || has_object_property (widget, "item"))
            return null;
        if (widget.get_type ().is_a (files_view))
            in_view = true;
        if (!in_view || !has_object_property (widget, "location"))
            continue;
        File? location = null;
        widget.get ("location", out location);
        return location != null && location.get_path () != null ? location.get_uri () : null;
    }
    return null;
}

async void open_wheel (string method, string uri) {
    try {
        var bus = yield Bus.get (BusType.SESSION);
        var arg = method == "Open" ? new Variant.strv ({ uri }) : new Variant.string (uri);
        yield bus.call ("org.gnome.Shell", "/org/gnome/Shell/Extensions/ActionWheel",
                        "org.gnome.Shell.Extensions.ActionWheel", method,
                        new Variant.tuple ({ arg }),
                        null, DBusCallFlags.NONE, -1);
    } catch (Error e) {
        warning ("action-wheel: %s", e.message);
    }
}

void hook_windows (ListModel toplevels) {
    for (uint i = 0; i < toplevels.get_n_items (); i++) {
        var window = (Gtk.Window) toplevels.get_item (i);
        if (window.get_data<string> ("action-wheel") != null)
            continue;
        window.set_data<string> ("action-wheel", "hooked");
        var click = new Gtk.GestureClick ();
        click.button = Gdk.BUTTON_PRIMARY;
        click.propagation_phase = Gtk.PropagationPhase.CAPTURE;
        click.pressed.connect (on_pressed);
        click.released.connect (on_released);
        ((Gtk.Widget) window).add_controller (click);
    }
}

[CCode (cname = "nautilus_module_initialize")]
public void module_initialize (TypeModule module) {
    unowned var toplevels = Gtk.Window.get_toplevels ();
    toplevels.items_changed.connect (() => hook_windows (toplevels));
    hook_windows (toplevels);
}

[CCode (cname = "nautilus_module_shutdown")]
public void module_shutdown () {
}

[CCode (cname = "nautilus_module_list_types")]
public void module_list_types (out unowned Type[] types) {
    types = null;
}
