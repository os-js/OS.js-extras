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
const Menu = OSjs.require('gui/menu');
const DOM = OSjs.require('utils/dom');

export default class ApplicationGmailMessageWindow extends Window {

  constructor(app, metadata, mailArgs) {
    mailArgs = mailArgs || {};
    super('ApplicationGmailMessageWindow', {
      icon: metadata.icon,
      title: metadata.name + ': ' + (mailArgs.to || mailArgs.subject || '<new message>'),
      allow_session: false,
      width: 500,
      height: 400
    }, app);

    this.mailArgs = mailArgs;
    this.attachmentMenu = [];
  }

  init(wmRef, app) {
    var self = this;
    var root = super.init(...arguments);

    // Load and set up scheme (GUI) here
    this._render('GmailMessageWindow', require('osjs-scheme-loader!scheme.html'));

    var input = this._find('Input');
    var subject = this._find('Subject').set('value', this.mailArgs.subject || '');
    var to = this._find('To').set('value', this.mailArgs.to || '');

    var menuMap = {
      MenuClose: function() {
        self._close();
      },
      Reply: function() {
        self._toggleLoading(true);
        app.replyToMessage(self.mailArgs.id, function() {
          self._toggleLoading(false);
        });

        self._close();
      },
      Send: function() {
        app.sendMessage(self, to.get('value'), subject.get('value'), input.get('value'));
      },
      Attachments: function(ev) {
        var pos = DOM.$position(ev.target);
        Menu.create(self.attachmentMenu, {x: pos.left, y: pos.top});
      }
    };

    function menuEvent(ev) {
      if ( menuMap[ev.detail.id] ) {
        menuMap[ev.detail.id](ev);
      }
    }

    if ( this.mailArgs && this.mailArgs.id ) {
      this._find('ViewInput').hide();
      this._find('EntrySubject').hide();
      this._find('EntryTo').hide();

      this._find('Send').set('disabled', true);
    } else {
      this._find('ViewMessage').hide();
      this._find('Attachments').set('disabled', true);
      this._find('Reply').set('disabled', true);
    }

    this._find('SubmenuFile').on('select', menuEvent);
    this._find('Menubar').on('select', menuEvent);

    return root;
  }

  _inited() {
    super._inited(...arguments);

    if ( this.mailArgs.id && this._app ) {
      this._app.recieveMessage(this, this.mailArgs.id);
    }
  }

  onPrepareReceive() {
    this._toggleLoading(true);
    this._find('Statusbar').set('value', 'Preparing to receive email...');
  }

  onEndReceive(parsed) {
    var self = this;

    this._toggleLoading(false);

    if ( this.mailArgs.onRecieved ) {
      this.mailArgs.onRecieved();
    }

    if ( !parsed ) {
      return;
    }

    var l = parsed.attachments.length;
    var items = [];
    parsed.attachments.forEach(function(i) {
      items.push({
        title: i.filename + ' (' + i.mime + ', ' + i.size + 'b)',
        onClick: function() {
          if ( self._app ) {
            self._app.downloadAttachment(self, i);
          }
        }
      });
    });

    this.attachmentMenu = items;

    var text = 'Message downloaded (' + l + ' attachments)';
    this._find('Statusbar').set('value', text);
    this._find('Message').set('value', parsed.raw);
  }

  onPrepareSend() {
    this._toggleLoading(true);
    this._find('Statusbar').set('value', 'Preparing to send email...');
  }

  onEndSend(result, error) {
    this._toggleLoading(false);

    if ( result ) {
      this._close();
    } else {
      this._find('Statusbar').set('value', 'FAILED TO SEND MESSAGE: ' + error);
    }
  }
}
