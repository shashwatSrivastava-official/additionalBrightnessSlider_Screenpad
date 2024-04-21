/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */
"use strict";

const { Gio, GLib, GObject, St } = imports.gi;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const Domain = Gettext.domain(Me.metadata.uuid);
const _ = Domain.gettext;

function setTimeout(func, delay, ...args) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        func(...args);
        return GLib.SOURCE_REMOVE;
    });
};

function clearTimeout(timeout) { GLib.source_remove(timeout); };

class KbdBrightnessProxy {
    constructor(callback) {
        this._callback = callback;
    }

    get Brightness() {
        let [success, stdout, stderr] = GLib.spawn_command_line_sync('brightnessctl g');
        if (!success) {
            log(`Error getting brightness: ${stderr}`);
            return 0;
        }
        let brightness = parseInt(stdout.toString().trim(), 10);
        return brightness / 100; // Assuming brightnessctl returns a percentage
    }

    set Brightness(value) {
        const brightness = Math.round(value * 100); // Convert to percentage
        log(`Setting brightness to ${brightness}%`);
        GLib.spawn_command_line_sync(`brightnessctl s ${brightness}%`);
    }

    getMaxBrightness() {
        let [success, stdout, stderr] = GLib.spawn_command_line_sync('brightnessctl g');
        if (!success) {
            log(`Error getting max brightness: ${stderr}`);
            return 100; // Default to 100% if we can't get the max
        }
        let maxBrightness = parseInt(stdout.toString().trim(), 10);
        return maxBrightness; // Assuming brightnessctl returns a percentage
    }
}

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.SystemIndicator {
        _init() {
            super._init();
            this._proxy = new KbdBrightnessProxy((proxy, error) => {
                if (error) throw error;
                proxy.connectSignal('BrightnessChanged', this._sync.bind(this));
                this._sync();
            });

            this._item = new PopupMenu.PopupBaseMenuItem({ activate: false });
            this.menu.addMenuItem(this._item);

            this._slider = new Slider.Slider(0);
            this._sliderChangedId = this._slider.connect('notify::value',
                this._sliderChanged.bind(this));
            this._slider.accessible_name = _("Keyboard brightness");

            let icon = new St.Icon({
                icon_name: 'keyboard-brightness-symbolic',
                style_class: 'popup-menu-icon'
            });
            this._item.add(icon);
            this._item.add_child(this._slider);
            this._item.connect('button-press-event', (actor, event) => {
                return this._slider.startDragging(event);
            });
            this._item.connect('key-press-event', (actor, event) => {
                return this._slider.emit('key-press-event', event);
            });
            this._item.connect('scroll-event', (actor, event) => {
                return this._slider.emit('scroll-event', event);
            });
            this.lastChange = Date.now();
            this.changeSliderTimeout = null;
        }

        _sliderChanged() {
            this.lastChange = Date.now();
            this._proxy.Brightness = this._slider.value;
        }

        _changeSlider(value) {
            this._slider.block_signal_handler(this._sliderChangedId);
            this._slider.value = value;
            this._slider.unblock_signal_handler(this._sliderChangedId);
        }

        _sync() {
            let visible = this._proxy.Brightness >= 0;
            this._item.visible = visible;
            if (visible) {
                if (this.changeSliderTimeout) clearTimeout(this.changeSliderTimeout);
                let dt = this.lastChange + 1000 - Date.now();
                if (dt < 0) dt = 0;
                this.changeSliderTimeout = setTimeout(_ => {
                    this.changeSliderTimeout = null;
                    this._changeSlider(this._proxy.Brightness)
                }, dt);
            }
        }

        destroy() {
            if (this.changeSliderTimeout) clearTimeout(this.changeSliderTimeout);
            this.menu.destroy();
            super.destroy();
        }
    });

var _indicator;

function init() {
    log(`initializing ${Me.metadata.name}`);
    ExtensionUtils.initTranslations(Me.metadata.uuid);
}

function enable() {
    _indicator = new Indicator();
    Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this._indicator.menu, 3);
}

function disable() {
    _indicator.destroy();
    _indicator = null;
}
