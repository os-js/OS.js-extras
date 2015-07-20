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

  var ApplicationGmailMessageWindow = function(app, metadata, mailArgs) {
    mailArgs = mailArgs || {};
    Window.apply(this, ['ApplicationGmailMessageWindow', {
      icon: metadata.icon,
      title: metadata.name + ': ' + (mailArgs.to || mailArgs.subject || '<new message>'),
      allow_session: false,
      width: 500,
      height: 400
    }, app]);

    this.mailArgs = mailArgs;
    this.menuBar = null;
    this.statusBar = null;
    this.inputMessage = null;
  };

  ApplicationGmailMessageWindow.prototype = Object.create(Window.prototype);

  ApplicationGmailMessageWindow.prototype.init = function(wmRef, app) {
    var self = this;
    var root = Window.prototype.init.apply(this, arguments);


    var sender = this.mailArgs.sender || this.mailArgs.to;
    var subject = this.mailArgs.subject || '';
    var message = this.mailArgs.message || '';
    var disable = !!this.mailArgs.id;

    var vboxMain = this._addGUIElement(new GUI.VBox('ApplicationGmailMessageVboxMain'), root);
    var container;
    var menuBar, statusBar;
    var inputTo, inputSubject, inputMessage;

    //
    // Menu Bar
    //
    container = vboxMain.insert('MenuBar', 0, 1);
    menuBar = this._addGUIElement(new GUI.MenuBar('ApplicationGmailMessageMenuBar'), container);
    menuBar.addItem(API._('LBL_FILE'), [
      {title: API._('LBL_CLOSE'), name: 'Close', onClick: function() {
        self._close();
      }}
    ]);
    if ( disable ) {
      menuBar.addItem('Reply', []);
    } else {
      menuBar.addItem('Send', []);
    }
    menuBar.onMenuOpen = function(menu, mpos, mtitle, menuBar) {
      if ( !app ) return;

      var to = inputTo ? inputTo.getValue() : null;
      var subject = inputSubject ? inputSubject.getValue() : null;
      var txt = inputMessage ? inputMessage.getContent() : null;
      if ( mtitle === 'Send' ) {
        app.sendMessage(self, to, subject, txt);
      } else if ( mtitle === 'Reply' ) {
        self._toggleLoading(true);
        app.replyToMessage(self.mailArgs.id, function() {
          self._toggleLoading(false);
        });

        self._close();
      }
    };

    //
    // Fields
    //
    container = vboxMain.insert('Fields', 0, 1);
    inputTo = this._addGUIElement(new GUI.Text('ApplicationGmailMessageTo', {placeholder: 'To...', value: sender, disabled: disable}), container);
    inputSubject = this._addGUIElement(new GUI.Text('ApplicationGmailMessageSubject', {placeholder: 'Subject...', value: subject, disabled: disable}), container);

    //
    // Main View
    //
    container = vboxMain.insert('Message', 1, 0);
    inputMessage = this._addGUIElement(new GUI.RichText('ApplicationGmailMessageText', {value: message, editable: !disable}), container);

    //
    // Status Bar
    //
    container = vboxMain.insert('StatusBar', 0, 1);
    statusBar = this._addGUIElement(new GUI.StatusBar('ApplicationGmailMessageStatusBar'), container);

    this.statusBar = statusBar;
    this.inputMessage = inputMessage;
    this.menuBar = menuBar;

    return root;
  };

  ApplicationGmailMessageWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);

    if ( this.mailArgs.id && this._appRef ) {
      this._appRef.recieveMessage(this, this.mailArgs.id);
    }
  };

  ApplicationGmailMessageWindow.prototype.destroy = function() {
    Window.prototype.destroy.apply(this, arguments);
    this.statusBar = null;
    this.inputMessage = null;
    this.menuBar = null;
  };

  ApplicationGmailMessageWindow.prototype.onPrepareReceive = function() {
    this._toggleLoading(true);
    if ( this.statusBar ) {
      this.statusBar.setText('Preparing to receive email...');
    }
  };

  ApplicationGmailMessageWindow.prototype.onEndReceive = function(parsed) {
    var self = this;

    this._toggleLoading(false);

    if ( this.mailArgs.onRecieved ) {
      this.mailArgs.onRecieved();
    }

    if ( !parsed ) return;

    var l = parsed.attachments.length;
    if ( this.menuBar && l ) {
      var items = [];
      parsed.attachments.forEach(function(i) {
        items.push({
          title: i.filename + ' (' + i.mime + ', ' + i.size + 'b)',
          name: i.filename,
          onClick: function() {
            if ( self._appRef ) {
              self._appRef.downloadAttachment(self, i);
            }
          }
        });
      });

      this.menuBar.addItem('Attachments', items);
    }

    if ( this.statusBar ) {
      var text = 'Message downloaded (' + l + ' attachments)';
      this.statusBar.setText(text);
    }

    if ( this.inputMessage ) {
      this.inputMessage.setContent(parsed.raw);
    }
  };

  ApplicationGmailMessageWindow.prototype.onPrepareSend = function() {
    this._toggleLoading(true);
    if ( this.statusBar ) {
      this.statusBar.setText('Preparing to send email...');
    }
  };

  ApplicationGmailMessageWindow.prototype.onEndSend = function(result, error) {
    this._toggleLoading(false);

    if ( result ) {
      this._close();
    } else {
      if ( this.statusBar ) {
        this.statusBar.setText('FAILED TO SEND MESSAGE: ' + error);
      }
    }
  };


  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationGmail = OSjs.Applications.ApplicationGmail || {};
  OSjs.Applications.ApplicationGmail.MessageWindow = ApplicationGmailMessageWindow;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
