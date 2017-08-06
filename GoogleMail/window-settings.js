/*!
 * OS.js - JavaScript Operating System
 *
 * Copyright (c) 2011-2017, Anders Evenrud <andersevenrud@gmail.com>
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
const Window = OSjs.require('core/window');

export default class ApplicationGmailSettingsWindow extends Window {

  constructor(app, metadata, maxPages) {
    super('ApplicationGmailSettingsWindow', {
      icon: metadata.icon,
      title: metadata.name + ' - Settings',
      allow_session: false,
      allow_resize: false,
      allow_maximize: false,
      width: 400,
      height: 200
    }, app);

    this.defaultMaxPages = metadata.settings ? metadata.settings.maxPages : 10;
    this.currentMaxPages = maxPages || this.defaultMaxPages;
  }

  init(wmRef, app) {
    var self = this;
    var root = super.init(...arguments);

    // Load and set up scheme (GUI) here
    this._render('GmailSettingsWindow', require('osjs-scheme-loader!scheme.html'));

    function save(maxPages) {
      if ( maxPages && self._appRef ) {
        maxPages = parseInt(maxPages, 10);
        if ( isNaN(maxPages) || maxPages < 0 || maxPages > self.defaultMaxPages ) {
          maxPages = self.defaultMaxPages;
        }

        app._setSetting('maxPages', maxPages, true, function() {
          self._close();
        });
        return;
      }
      self._close();
    }

    var maxPages = this._find('MaxPages').set('value', this.currentMaxPages);

    this._find('ButtonClose').on('click', function() {
      save(false);
    });
    this._find('ButtonSave').on('click', function() {
      save(maxPages.get('value'));
    });

    return root;
  }
}

