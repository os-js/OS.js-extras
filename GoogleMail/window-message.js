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

  var ApplicationGmailMessageWindow = function(app, metadata, mailArgs, scheme) {
    mailArgs = mailArgs || {};
    Window.apply(this, ['ApplicationGmailMessageWindow', {
      icon: metadata.icon,
      title: metadata.name + ': ' + (mailArgs.to || mailArgs.subject || '<new message>'),
      allow_session: false,
      width: 500,
      height: 400
    }, app, scheme]);

    this.mailArgs = mailArgs;
    this.attachmentMenu = [];
  };

  ApplicationGmailMessageWindow.prototype = Object.create(Window.prototype);

  ApplicationGmailMessageWindow.prototype.init = function(wmRef, app, scheme) {
    var self = this;
    var root = Window.prototype.init.apply(this, arguments);

    // Load and set up scheme (GUI) here
    scheme.render(this, 'GmailMessageWindow', root);

    var input = scheme.find(this, 'Input');
    var subject = scheme.find(this, 'Subject').set('value', this.mailArgs.subject || '');
    var to = scheme.find(this, 'To').set('value', this.mailArgs.to || '');

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
        var pos = Utils.$position(ev.target);
        API.createMenu(self.attachmentMenu, {x: pos.left, y: pos.top});
      }
    };

    function menuEvent(ev) {
      if ( menuMap[ev.detail.id] ) {
        menuMap[ev.detail.id](ev);
      }
    }

    if ( this.mailArgs && this.mailArgs.id ) {
      scheme.find(this, 'ViewInput').hide();
      scheme.find(this, 'EntrySubject').hide();
      scheme.find(this, 'EntryTo').hide();

      scheme.find(this, 'Send').set('disabled', true);
    } else {
      scheme.find(this, 'ViewMessage').hide();
      scheme.find(this, 'Attachments').set('disabled', true);
      scheme.find(this, 'Reply').set('disabled', true);
    }

    scheme.find(this, 'SubmenuFile').on('select', menuEvent);
    scheme.find(this, 'Menubar').on('select', menuEvent);

    return root;
  };

  ApplicationGmailMessageWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);

    if ( this.mailArgs.id && this._app ) {
      this._app.recieveMessage(this, this.mailArgs.id);
    }
  };

  ApplicationGmailMessageWindow.prototype.onPrepareReceive = function() {
    this._toggleLoading(true);
    this._scheme.find(this, 'Statusbar').set('value', 'Preparing to receive email...');
  };

  ApplicationGmailMessageWindow.prototype.onEndReceive = function(parsed) {
    var self = this;

    this._toggleLoading(false);

    if ( this.mailArgs.onRecieved ) {
      this.mailArgs.onRecieved();
    }

    if ( !parsed ) return;

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
    this._scheme.find(this, 'Statusbar').set('value', text);
    this._scheme.find(this, 'Message').set('value', parsed.raw);
  };

  ApplicationGmailMessageWindow.prototype.onPrepareSend = function() {
    this._toggleLoading(true);
    this._scheme.find(this, 'Statusbar').set('value', 'Preparing to send email...');
  };

  ApplicationGmailMessageWindow.prototype.onEndSend = function(result, error) {
    this._toggleLoading(false);

    if ( result ) {
      this._close();
    } else {
      this._scheme.find(this, 'Statusbar').set('value', 'FAILED TO SEND MESSAGE: ' + error);
    }
  };


  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationGmail = OSjs.Applications.ApplicationGmail || {};
  OSjs.Applications.ApplicationGmail.MessageWindow = ApplicationGmailMessageWindow;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
