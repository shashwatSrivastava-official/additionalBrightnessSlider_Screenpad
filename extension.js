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

const { St, Clutter, Gio, GLib, GObject } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

var BrightnessIndicator = GObject.registerClass(
  class BrightnessIndicator extends PanelMenu.SystemIndicator {
    _init() {
      super._init();

      let icon = new St.Icon({
        icon_name: "keyboard-brightness-symbolic",
        style_class: "popup-menu-icon",
      });

      // Define _sliderItem as a property of this object
      this._sliderItem = new PopupMenu.PopupBaseMenuItem({ activate: false });
      this._slider = new Slider.Slider(0);
      this._slider.connect("notify::value", this._sliderChanged.bind(this));
      this.menu.addMenuItem(this._sliderItem);
      this._sliderItem.add(icon);
      this._sliderItem.add_child(this._slider);

      this._maxBrightness = this._getMaxBrightness();
      this._updateBrightness();
    }

    _updateBrightness() {
      let [result, stdout, stderr] = GLib.spawn_command_line_sync(
        "brightnessctl -d asus_screenpad get"
      );
      if (!result) {
        log(`Error reading brightness: ${stderr.toString()}`);
        return;
      }
      const currentBrightness = parseInt(stdout.toString().trim());
      this._slider.value = currentBrightness / this._maxBrightness;
    }

    _getMaxBrightness() {
      let [result, stdout, stderr] = GLib.spawn_command_line_sync(
        "brightnessctl -d asus_screenpad max"
      );
      if (!result) {
        log(`Error getting max brightness: ${stderr}`);
        return 100; // Default to 100 if there is an error
      }
      return parseInt(stdout.toString().trim());
    }

    _sliderChanged() {
      const brightnessValue = Math.round(
        this._slider.value * this._maxBrightness
      );
      GLib.spawn_command_line_sync(
        `brightnessctl -d asus_screenpad set ${brightnessValue}%`
      );
    }
  }
);

let brightnessIndicator;

function init() {
  log(
    "---------------------------Brightness control extension initializing---------------------------"
  );
}

function enable() {
  brightnessIndicator = new BrightnessIndicator();
  Main.panel.statusArea.aggregateMenu.menu.addMenuItem(
    brightnessIndicator.menu,
    3
  );
}

function disable() {
  brightnessIndicator.destroy();
  brightnessIndicator = null;
}
