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

  function safeName(str) {
    return (str || '').replace(/[^A-z0-9\s\+\-_\&]/g, '');
  }

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application constructor
   */
  var ApplicationGmail = function(args, metadata) {
    Application.apply(this, ['ApplicationGmail', args, metadata]);

    this.mainWindow = null;
    this.currentFolder = 'INBOX';
    this.currentMessage = null;
    this._scheme;
  };

  ApplicationGmail.prototype = Object.create(Application.prototype);

  ApplicationGmail.prototype.destroy = function() {
    if ( this.mailer ) {
      this.mailer.destroy();
    }
    this._scheme = null;
    return Application.prototype.destroy.apply(this, arguments);
  };

  ApplicationGmail.prototype.init = function(settings, metadata, onInited) {
    var self = this;

    Application.prototype.init.apply(this, arguments);
    var defaultSettings = metadata.settings || {};
    settings = Utils.argumentDefaults(settings, defaultSettings);

    function onloaded() {
      if ( !self._getArgument('__resume__') ) {
        var action = self._getArgument('action');
        if ( action ) {
          self.handleAction(self._getArguments());
        }
      }

      self.mailer = new OSjs.Applications.ApplicationGmail.GoogleMail({
        maxPages: settings.maxPages,
        onAbortStart: function() {
          if ( self.mainWindow ) {
            self.mainWindow._toggleLoading(true);
          }
        },
        onAbortEnd: function() {
          if ( self.mainWindow ) {
            self.mainWindow._toggleLoading(false);
          }
        }
      }, function(error, result) {
        if ( self.mainWindow && self.mailer.user ) {
          self.mainWindow.updateTitleBar(self.mailer.user);
        }
        self.sync();
      });

      onInited();
    }

    var url = API.getApplicationResource(this, './scheme.html');

    this._scheme = GUI.createScheme(url);
    this._scheme.load(function(error, result) {
      self.mainWindow = self._addWindow(new OSjs.Applications.ApplicationGmail.MainWindow(self, metadata, self._scheme, settings));
      onloaded();
    });
  };

  ApplicationGmail.prototype._onMessage = function(obj, msg, args) {
    Application.prototype._onMessage.apply(this, arguments);

    if ( msg == 'destroyWindow' && obj._name === 'ApplicationGmailWindow' ) {
      this.destroy();
    } else if ( msg === 'attention' ) {
      this.handleAction(args);
    }
  };

  ApplicationGmail.prototype.handleAction = function(args) {
    args = args || {};
    if ( args.action ) {
      if ( args.action === 'create' && args.email ) {
        this.openMessageWindow({to: args.email});
      }
    }
  };

  ApplicationGmail.prototype.openMessageWindow = function(args) {
    this._addWindow(new OSjs.Applications.ApplicationGmail.MessageWindow(this, this.__metadata, args, this._scheme));
  };

  ApplicationGmail.prototype.openSettingsWindow = function() {
    if ( !this.mailer ) return;

    var win = this._getWindowByName('ApplicationGmailSettingsWindow');
    if ( win ) {
      win._restore();
      return;
    }

    var maxPages = this.mailer.args.maxPages;
    win = this._addWindow(new OSjs.Applications.ApplicationGmail.SettingsWindow(this, this.__metadata, maxPages, this._scheme));
    win._focus();
  };

  ApplicationGmail.prototype.openContacts = function(win) {
    API.launch('ApplicationGoogleContacts', {
    });
  };

  ApplicationGmail.prototype.replyToMessage = function(id, cb) {
    var self = this;

    this.mailer.recieveMessage({
      id: id,
      returnFull: true,
    }, function(error, parsed) {
      if ( parsed && parsed.data ) {
        self.openMessageWindow({
          to: parsed.data.sender,
          subject: 'RE: ' + parsed.data.subject,
          message: 'TODO'
        });
      }

      cb();
    });
  };

  ApplicationGmail.prototype.downloadAttachment = function(win, att) {
    if ( !this.mailer ) {
      return;
    }
    this.mailer.downloadAttachment({
      id: att.messageId,
      mime: att.mime,
      filename: att.filename,
      attachmentId: att.id
    });
  };

  ApplicationGmail.prototype.moveMessage = function(win, moveTo, cb) {
    var self = this;
    cb = cb || function() {};
    if ( !this.mailer ) {
      return;
    }

    if ( win ) { win._toggleLoading(true); }

    var id = this.currentMessage;
    var folder = this.currentFolder;
    this.mailer.move({
      id: id,
      to: moveTo,
      from: folder
    }, function(error, result) {
      if ( win ) { win._toggleLoading(false); }
      cb();
    });
  };

  ApplicationGmail.prototype.markMessage = function(markAs, win, cb) {
    cb = cb || function() {};
    if ( !this.mailer ) {
      return;
    }

    if ( win ) { win._toggleLoading(true); }

    var id = this.currentMessage;
    this.mailer.markMessage({
      markAs: markAs,
      id: id
    }, function(error, result, id, state) {
      if ( win ) { win._toggleLoading(false); }
      cb(error, result, id, state);
    });
  };

  ApplicationGmail.prototype.removeMessage = function(win, cb) {
    cb = cb || function() {};
    if ( !this.mailer ) {
      return;
    }

    if ( win ) { win._toggleLoading(true); }

    var id = this.currentMessage;
    this.mailer.removeMessage({
      id: id
    }, function(error, result) {
      if ( win ) { win._toggleLoading(false); }
      cb();
    });
  };

  ApplicationGmail.prototype.recieveMessage = function(win, id) {
    if ( !this.mailer ) {
      return;
    }

    if ( win ) { win.onPrepareReceive(); }

    this.mailer.recieveMessage({
      id: id,
      markRead: true
    }, function(error, result) {
      if ( win ) { win.onEndReceive(result); }
    });
  };

  ApplicationGmail.prototype.sendMessage = function(win, to, subject, message) {
    if ( !this.mailer ) {
      return;
    }

    this.mailer.sendMessage({
      to: to,
      subject: subject,
      message: message
    }, function(error, result) {
      if ( win && result ) {
        win._close();
      }
    });
  };

  ApplicationGmail.prototype.getFolderCache = function(cb) {
    this.mailer.getFolders({cache: true}, function(error, result) {
      cb(false, result || []);
    });
  };

  ApplicationGmail.prototype.forceSync = function(win) {
    var self = this;
    win = win || this.mainWindow;

    if ( !this.mailer ) {
      return;
    }

    this.sync(win, true);
  };

  ApplicationGmail.prototype.sync = function(win, force, onlyFolders) {
    force = force === true;

    var self = this;

    win = win || this.mainWindow;

    if ( !this.mailer ) {
      return;
    }

    var folderId = this.currentFolder;
    this.mailer.getFolders({force: force}, function(error, result) {
      if ( win && result ) {
        win.renderFolders(result, folderId);
      }

      if ( onlyFolders ) {
        return;
      }

      self.mailer.getMessages({
        force: force,
        folder: folderId,
        onPageAdvance: function(json) {
          if ( win ) {
            var per = json.pageCurrent / json.pagesTotal * 100;
            var msg = 'Fetching page ' + json.pageCurrent;
            if ( force ) {
              msg += ' (Forced)';
            }
            win.updateStatusBar({message: msg, progress: per});

            // This will make it so listview is not cleared when refreshing
            // a folder
            if ( json.refresh && json.pageCurrent < json.pagesTotal ) {
              return;
            }

            var messages = json.messages || [];
            win.renderMessages(messages, self.currentMessage);
          }
        },
        onMessageQueue: function(json) {
          if ( win ) {
            var per = json.messageCurrent / json.messagesTotal * 100;
            var msg = Utils.format('Fetching message (batch {0}/{1}, message {2}/{3}, index {4}) in {5}',
              json.pageCurrent,
              json.pagesTotal,
              json.messageCurrent,
              json.messagesTotal,
              json.messageIndex,
              json.folder
            );
            if ( force ) {
              msg += ' (Forced)';
            }

            win.updateStatusBar({message: msg, progress: per});
          }
        },
        onStart: function() {
          if ( win ) {
            win.updateStatusBar({message: 'Fetching messages...'});
          }
        },
        onEnd: function() {
          if ( win ) {
            win.updateStatusBar();
          }
        }
      }, function(error, result) {
        if ( win ) {
          win.renderMessages(result, self.currentMessage);
        }
      });
    });
  };

  ApplicationGmail.prototype.createFolder = function(win) {
    var self = this;
    win = win || this.mainWindow;
    if ( !win || !this.mailer ) return;

    win._toggleDisabled(true);
    var msg = 'Enter a name for the folder';
    this._createDialog('Input', [msg, '', function(btn, input) {
      if ( win ) { win._toggleDisabled(false); }
      if ( !input || btn !== 'ok' ) return;
      if ( win ) { win._toggleLoading(true); }
      input = safeName(input);

      self.mailer.createFolder({
        name: input
      }, function() {
        if ( win ) { win._toggleLoading(false); }
        self.sync(null, false, true);
      });
    }]);
  };

  ApplicationGmail.prototype.renameFolder = function(win, id, title) {
    var self = this;
    win = win || this.mainWindow;
    if ( !win || !this.mailer ) return;

    win._toggleDisabled(true);
    var msg = 'Enter a name for the folder';
    this._createDialog('Input', [msg, title, function(btn, input) {
      if ( win ) { win._toggleDisabled(false); }
      if ( !input || btn !== 'ok' ) return;
      if ( win ) { win._toggleLoading(true); }
      input = safeName(input);

      self.mailer.renameFolder({
        id: id,
        name: input
      }, function() {
        if ( win ) { win._toggleLoading(false); }
        self.sync(null, false, true);
      });
    }]);
  };

  ApplicationGmail.prototype.removeFolder = function(win, id, title) {
    var self = this;
    win = win || this.mainWindow;
    if ( !win || !this.mailer ) return;

    win._toggleDisabled(true);
    var msg = 'Are you sure you want to delete this folder (' + title + ')?';
    this._createDialog('Confirm', [msg, function(btn) {
      if ( win ) { win._toggleDisabled(false); }
      if ( btn !== 'ok' ) return;
      if ( win ) { win._toggleLoading(true); }

      self.mailer.removeFolder({id: id}, function() {
        if ( win ) { win._toggleLoading(false); }
        if ( self.currentFolder === id ) {
          self.setFolder('INBOX', true);
          return;
        }

        self.sync(null, false, true);
      });
    }]);
  };

  ApplicationGmail.prototype.setMessage = function(msg) {
    this.currentMessage = msg;
  };

  ApplicationGmail.prototype.setFolder = function(folder, setUI) {
    if ( folder && folder !== this.currentFolder || setUI ) {
      this.currentFolder = folder;
      this.currentMessage = null;
      if ( setUI && this.mainWindow ) {
        this.mainWindow.setSelectedFolder(folder);
      }
      this.sync();
    }
  };

  ApplicationGmail.prototype._setSetting = function(k, v, save, saveCallback) {
    var self = this;
    Application.prototype._setSetting.call(this, k, v, save, function() {
      if ( self.mailer && k === 'maxPages' ) {
        self.mailer.setMaxPages(v);
      }
      (saveCallback || function() {}).apply(this, arguments);
    });
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationGmail = OSjs.Applications.ApplicationGmail || {};
  OSjs.Applications.ApplicationGmail.Class = ApplicationGmail;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
