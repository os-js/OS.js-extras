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
import MainWindow from './window-main.js';
import MessageWindow from './window-message.js';
import SettingsWindow from './window-settings.js';
import {GoogleMail} from './mailer.js';

const Utils = OSjs.require('utils/misc');
const Application = OSjs.require('core/application');

function safeName(str) {
  return (str || '').replace(/[^A-z0-9\s\+\-_\&]/g, '');
}

class ApplicationGmail extends Application {
  constructor(args, metadata) {
    super('ApplicationGmail', args, metadata);

    this.mainWindow = null;
    this.currentFolder = 'INBOX';
    this.currentMessage = null;
  }

  destroy() {
    if ( this.mailer ) {
      this.mailer.destroy();
    }
    return super.destroy(...arguments);
  }

  init(settings, metadata) {
    var self = this;

    super.init(...arguments);

    var defaultSettings = metadata.settings || {};
    settings = Utils.argumentDefaults(settings, defaultSettings);

    this.mainWindow = this._addWindow(new MainWindow(this, metadata, settings));
    if ( !this._getArgument('__resume__') ) {
      var action = self._getArgument('action');
      if ( action ) {
        self.handleAction(self._getArguments());
      }
    }

    this.mailer = new GoogleMail({
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

    this._on('destroyWindow', function(obj) {
      if ( obj._name === 'ApplicationGmailWindow' ) {
        self.destroy();
      }
    });
    this._on('attention', function(args) {
      self.handleAction(args);
    });
  }

  handleAction(args) {
    args = args || {};
    if ( args.action ) {
      if ( args.action === 'create' && args.email ) {
        this.openMessageWindow({to: args.email});
      }
    }
  }

  openMessageWindow(args) {
    this._addWindow(new MessageWindow(this, this.__metadata, args));
  }

  openSettingsWindow() {
    if ( !this.mailer ) {
      return;
    }

    var win = this._getWindowByName('ApplicationGmailSettingsWindow');
    if ( win ) {
      win._restore();
      return;
    }

    var maxPages = this.mailer.args.maxPages;
    win = this._addWindow(new SettingsWindow(this, this.__metadata, maxPages));
    win._focus();
  }

  openContacts(win) {
    Application.create('ApplicationGoogleContacts');
  }

  replyToMessage(id, cb) {
    var self = this;

    this.mailer.recieveMessage({
      id: id,
      returnFull: true
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
  }

  downloadAttachment(win, att) {
    if ( !this.mailer ) {
      return;
    }
    this.mailer.downloadAttachment({
      id: att.messageId,
      mime: att.mime,
      filename: att.filename,
      attachmentId: att.id
    });
  }

  moveMessage(win, moveTo, cb) {
    cb = cb || function() {};
    if ( !this.mailer ) {
      return;
    }

    if ( win ) {
      win._toggleLoading(true);
    }

    var id = this.currentMessage;
    var folder = this.currentFolder;
    this.mailer.move({
      id: id,
      to: moveTo,
      from: folder
    }, function(error, result) {
      if ( win ) {
        win._toggleLoading(false);
      }
      cb();
    });
  }

  markMessage(markAs, win, cb) {
    cb = cb || function() {};
    if ( !this.mailer ) {
      return;
    }

    if ( win ) {
      win._toggleLoading(true);
    }

    var id = this.currentMessage;
    this.mailer.markMessage({
      markAs: markAs,
      id: id
    }, function(error, result, id, state) {
      if ( win ) {
        win._toggleLoading(false);
      }
      cb(error, result, id, state);
    });
  }

  removeMessage(win, cb) {
    cb = cb || function() {};
    if ( !this.mailer ) {
      return;
    }

    if ( win ) {
      win._toggleLoading(true);
    }

    var id = this.currentMessage;
    this.mailer.removeMessage({
      id: id
    }, function(error, result) {
      if ( win ) {
        win._toggleLoading(false);
      }
      cb();
    });
  }

  recieveMessage(win, id) {
    if ( !this.mailer ) {
      return;
    }

    if ( win ) {
      win.onPrepareReceive();
    }

    this.mailer.recieveMessage({
      id: id,
      markRead: true
    }, function(error, result) {
      if ( win ) {
        win.onEndReceive(result);
      }
    });
  }

  sendMessage(win, to, subject, message) {
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
  }

  getFolderCache(cb) {
    this.mailer.getFolders({cache: true}, function(error, result) {
      cb(false, result || []);
    });
  }

  forceSync(win) {
    win = win || this.mainWindow;

    if ( !this.mailer ) {
      return;
    }

    this.sync(win, true);
  }

  sync(win, force, onlyFolders) {
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
  }

  createFolder(win) {
    var self = this;
    win = win || this.mainWindow;
    if ( !win || !this.mailer ) {
      return;
    }

    win._toggleDisabled(true);
    var msg = 'Enter a name for the folder';
    this._createDialog('Input', [msg, '', function(btn, input) {
      if ( win ) {
        win._toggleDisabled(false);
      }
      if ( !input || btn !== 'ok' ) {
        return;
      }
      if ( win ) {
        win._toggleLoading(true);
      }
      input = safeName(input);

      self.mailer.createFolder({
        name: input
      }, function() {
        if ( win ) {
          win._toggleLoading(false);
        }
        self.sync(null, false, true);
      });
    }]);
  }

  renameFolder(win, id, title) {
    var self = this;
    win = win || this.mainWindow;
    if ( !win || !this.mailer ) {
      return;
    }

    win._toggleDisabled(true);
    var msg = 'Enter a name for the folder';
    this._createDialog('Input', [msg, title, function(btn, input) {
      if ( win ) {
        win._toggleDisabled(false);
      }
      if ( !input || btn !== 'ok' ) {
        return;
      }
      if ( win ) {
        win._toggleLoading(true);
      }
      input = safeName(input);

      self.mailer.renameFolder({
        id: id,
        name: input
      }, function() {
        if ( win ) {
          win._toggleLoading(false);
        }
        self.sync(null, false, true);
      });
    }]);
  }

  removeFolder(win, id, title) {
    var self = this;
    win = win || this.mainWindow;
    if ( !win || !this.mailer ) {
      return;
    }

    win._toggleDisabled(true);
    var msg = 'Are you sure you want to delete this folder (' + title + ')?';
    this._createDialog('Confirm', [msg, function(btn) {
      if ( win ) {
        win._toggleDisabled(false);
      }
      if ( btn !== 'ok' ) {
        return;
      }
      if ( win ) {
        win._toggleLoading(true);
      }

      self.mailer.removeFolder({id: id}, function() {
        if ( win ) {
          win._toggleLoading(false);
        }
        if ( self.currentFolder === id ) {
          self.setFolder('INBOX', true);
          return;
        }

        self.sync(null, false, true);
      });
    }]);
  }

  setMessage(msg) {
    this.currentMessage = msg;
  }

  setFolder(folder, setUI) {
    if ( folder && folder !== this.currentFolder || setUI ) {
      this.currentFolder = folder;
      this.currentMessage = null;
      if ( setUI && this.mainWindow ) {
        this.mainWindow.setSelectedFolder(folder);
      }
      this.sync();
    }
  }

  _setSetting(k, v, save, saveCallback) {
    var self = this;
    super._setSetting(k, v, save, function() {
      if ( self.mailer && k === 'maxPages' ) {
        self.mailer.setMaxPages(v);
      }
      (saveCallback || function() {}).apply(this, arguments);
    });
  }
}

OSjs.Applications.ApplicationGmail = ApplicationGmail;
