#!/bin/sh
# Builds the Nautilus extension, installs it system-wide (sudo), and links the Shell extension.
# --build-only: build only. --dist: write the Shell extension zip and a source tarball to dist/.
set -e
cd "$(dirname "$0")"

if [ "$1" = "--dist" ]; then
    ext=shell/action-wheel@diegolopes
    version=$(sed -n 's/.*"version-name": *"\([^"]*\)".*/\1/p' "$ext/metadata.json")
    mkdir -p dist
    gnome-extensions pack -f -o dist --extra-source=actions --extra-source=icons \
        --extra-source=util.js --extra-source=editor.js --extra-source=trim.js "$ext"
    tar -czf "dist/gnome-action-wheel-$version.tar.gz" --transform "s,^,gnome-action-wheel-$version/," \
        LICENSE README.md install.sh nautilus shell
    ls -l dist
    exit
fi

mkdir -p build
# -w: hide C warnings from Vala-generated code. -z nodelete: the module registers no GTypes, so Nautilus may unload it while our gesture handlers are still attached.
valac --library=nautilus-action-wheel --pkg gtk4 -X -fPIC -X -shared -X -Wl,-z,nodelete -X -lnautilus-extension -X -w \
    -d build -o libnautilus-action-wheel.so nautilus/action-wheel.vala

if [ "$1" != "--build-only" ]; then
    sudo install -m644 build/libnautilus-action-wheel.so "$(pkg-config --variable=extensiondir libnautilus-extension-4)/"
    mkdir -p ~/.local/share/gnome-shell/extensions
    ln -sfn "$PWD/shell/action-wheel@diegolopes" ~/.local/share/gnome-shell/extensions/
fi
