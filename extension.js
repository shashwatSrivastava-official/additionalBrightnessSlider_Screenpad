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

const { St, Clutter, Gio } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const ExtensionUtils = imports.misc.extensionUtils;

const Util = imports.misc.util;

class BrightnessIndicator extends PanelMenu.Button {
  _init() {
    super._init(0.0, _("Monitor Brightness"));

    const icon = new St.Icon({
      icon_name: "display-brightness-symbolic",
      style_class: "system-status-icon",
    });

    this.add_child(icon);

    this._sliderItem = new PopupMenu.PopupSliderMenuItem(0.5);
    this._sliderItem.connect("value-changed", this._sliderChanged.bind(this));
    this.menu.addMenuItem(this._sliderItem);

    this._updateBrightness();
  }

  _updateBrightness() {
    Util.spawnCommandLine("brightnessctl -d DP-1 get", (stdout) => {
      const maxBrightness = this._getMaxBrightness();
      const currentBrightness = parseInt(stdout);
      this._sliderItem.setValue(currentBrightness / maxBrightness);
    });
  }

  _getMaxBrightness() {
    let stdout = Util.spawnCommandLineSync("brightnessctl -d DP-1 max");
    return parseInt(stdout.toString().trim());
  }

  _sliderChanged(slider, value) {
    const maxBrightness = this._getMaxBrightness();
    const brightnessValue = Math.round(value * maxBrightness);
    Util.spawnCommandLine(`brightnessctl -d DP-1 set ${brightnessValue}`);
  }
}

let brightnessIndicator;

function init() {
  log("Brightness control extension initializing");
}

function enable() {
  brightnessIndicator = new BrightnessIndicator();
  Main.panel.statusArea.aggregateMenu.menu.addMenuItem(brightnessIndicator, 3);
}

function disable() {
  brightnessIndicator.destroy();
  brightnessIndicator = null;
}
