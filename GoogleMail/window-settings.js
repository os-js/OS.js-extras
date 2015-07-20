/*!
 * OS.js - JavaScript Operating System
 *
 * Copyright (c) 2011-2015, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met: 
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer. 
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution. 
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */
(function(Application, Window, GUI, Dialogs, Utils, API, VFS) {

  var ApplicationGmailSettingsWindow = function(app, metadata, settings, maxPages) {
    Window.apply(this, ['ApplicationGmailSettingsWindow', {
      icon: metadata.icon,
      title: metadata.name + ' - Settings',
      allow_session: false,
      allow_resize: false,
      allow_maximize: false,
      width: 400,
      height: 200
    }, app]);

    this.defaultMaxPages = metadata.settings ? metadata.settings.maxPages : 10;
    this.currentMaxPages = maxPages || this.defaultMaxPages;
  };

  ApplicationGmailSettingsWindow.prototype = Object.create(Window.prototype);

  ApplicationGmailSettingsWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);

    var self = this;
    function save(maxPages) {
      if ( maxPages && self._appRef ) {
        maxPages = parseInt(maxPages, 10);
        if ( isNaN(maxPages) || maxPages < 0 || maxPages > self.defaultMaxPages ) {
          maxPages = self.defaultMaxPages;
        }

        self._appRef._setSetting('maxPages', maxPages, true, function() {
          self._close();
        });
        return;
      }
      self._close();
    }

    var container = document.createElement('div');
    container.className = 'Settings';
    this._addGUIElement(new GUI.Label('MaxPagesLabel', {label: 'Max Pages per folder (10 is absolute maximum)'}), container);
    var maxPagesInput = this._addGUIElement(new GUI.Text('MaxPages', {value: this.currentMaxPages}), container);
    root.appendChild(container);

    container = document.createElement('div');
    container.className = 'Buttons';

    this._addGUIElement(new GUI.Button('ButtonCancel', {label: API._('LBL_CANCEL'), onClick: function() {
      save(false);
    }}), container);
    this._addGUIElement(new GUI.Button('ButtonSave', {label: API._('LBL_SAVE'), onClick: function() {
      save(maxPagesInput ? maxPagesInput.getValue() : false);
    }}), container);

    root.appendChild(container);

    return root;
  };

  ApplicationGmailSettingsWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);
  };

  ApplicationGmailSettingsWindow.prototype.destroy = function() {
    Window.prototype.destroy.apply(this, arguments);
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationGmail = OSjs.Applications.ApplicationGmail || {};
  OSjs.Applications.ApplicationGmail.SettingsWindow = ApplicationGmailSettingsWindow;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
