import Gio from 'gi://Gio';

export default {
    label: 'Open With',
    icon: 'apps',
    empty: 'No applications for this file type',
    // Applications for the first file's type, default first. The list can repeat an app under two desktop IDs.
    children: (uris, types) => [Gio.AppInfo.get_default_for_type(types[0], false),
        ...Gio.AppInfo.get_recommended_for_type(types[0])]
        .filter((app, i, apps) => app && apps.findIndex(a => a?.get_display_name() === app.get_display_name()) === i)
        .slice(0, 7).map(app => ({
        label: app.get_display_name(),
        gicon: app.get_icon(),
        run: () => app.launch_uris(uris, global.create_app_launch_context(0, -1)),
    })),
};
