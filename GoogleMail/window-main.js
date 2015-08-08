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

  /////////////////////////////////////////////////////////////////////////////
  // HELPERS
  /////////////////////////////////////////////////////////////////////////////

  function resolveFolders(folders, current) {
    var fiters = [];
    var items = [];

    folders.forEach(function(i) {
      if ( i.name.match(/^CATEGORY_/) ) {
        return;
      }

      if ( i.name.match(/^(\[Imap\]|CHAT|DRAFT|UNREAD|INBOX|TRASH|IMPORTANT|STARRED|SPAM|SENT)/) ) {
        items.push({
          label: i.name,
          value: i.id,
          icon: OSjs.API.getIcon('places/folder.png')
        });
      } else {
        fiters.push({
          label: i.name,
          value: i.id,
          icon: OSjs.API.getIcon('places/folder.png')
        });
      }
    });

    function _sort(a, b) {
      var keyA = a.title;
          keyB = b.title;

      if(keyA < keyB) return -1;
      if(keyA > keyB) return 1;
      return 0;
    }

    items.sort(_sort);
    fiters.sort(_sort);

    fiters.unshift({
      label: '[Google]',
      value: null,
      icon: OSjs.API.getIcon('places/folder.png'),
      entries: items
    });

    return fiters;
  }

  function toggleReadState(id) {
    if ( messageView ) {
      var el = messageView.getItemByKey('id', id);
      if ( el && el._element ) {
        Utils.$removeClass(el._element, 'unread');
      }
    }
  }

  function toggleMessageState(id, state, row) {
    if ( messageView ) {
      var states = OSjs.Applications.ApplicationGmail.MessageStates;
      var el = messageView.getItemByKey('id', id);
      if ( el && el._element ) {
        row = el._element;
      }
      if ( row ) {
        Utils.$removeClass(row, 'unread');
        Utils.$removeClass(row, 'starred');

        if ( state & states.UNREAD ) {
          Utils.$addClass(row, 'unread');
        }
        if ( state & states.STARRED ) {
          Utils.$addClass(row, 'starred');
        }
      }
    }
  }

  function createMoveMenu(ev) {
    function resolveMenu(folders) {
      var fiters = [];
      var items = [];

      function cb(id) {
        app.moveMessage(self, id, function() {
          app.sync(self);
        });
      }

      folders.forEach(function(i) {
        if ( i.name.match(/^CATEGORY_/) ) {
          return;
        }

        if ( i.name.match(/^(\[Imap\]|CHAT|DRAFT|UNREAD|INBOX|TRASH|IMPORTANT|STARRED|SPAM|SENT)/) ) {
          items.push({
            title: i.name,
            onClick: function() {
              cb(i.id);
            }
          });
        } else {
          fiters.push({
            title: i.name,
            onClick: function() {
              cb(i.id);
            }
          });
        }
      });

      function _sort(a, b) {
        var keyA = a.title;
            keyB = b.title;

        if(keyA < keyB) return -1;
        if(keyA > keyB) return 1;
        return 0;
      }

      items.sort(_sort);
      fiters.sort(_sort);

      fiters.unshift({
        title: '[Google]',
        menu: items
      });

      return fiters;
    }

    if ( app ) {
      app.getFolderCache(function(error, list) {
        setTimeout(function() {
          OSjs.API.createMenu(resolveMenu(list), {x: ev.clientX, y: ev.clientY});
        }, 100);
      });
    }
  }


  /////////////////////////////////////////////////////////////////////////////
  // WINDOW
  /////////////////////////////////////////////////////////////////////////////

  var ApplicationGmailWindow = function(app, metadata, scheme, settings) {
    Window.apply(this, ['ApplicationGmailWindow', {
      icon: metadata.icon,
      title: metadata.name + ' v0.5',
      min_width: 500,
      min_height: 400,
      width: 600,
      height: 400
    }, app, scheme]);
  };

  ApplicationGmailWindow.prototype = Object.create(Window.prototype);

  ApplicationGmailWindow.prototype.init = function(wmRef, app, scheme) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    scheme.render(this, 'GmailWindow', root);

    var menuMap = {
      MenuClose:        function() { self._close(); },
      MenuFolderNew: function() {
        app.createFolder(self);
      },
      MenuFolderRename: function() {
        app.renameFolder(self, sel.id, sel.title);
      },
      MenuFolderDelete: function() {
        app.removeFolder(self, sel.id, sel.title);
      },
      MessageNew: function() {
        app.openMessageWindow();
      },
      MessageReply: function() {
        if ( app && app.currentMessage ) {
          self._toggleLoading(true);
          app.replyToMessage(app.currentMessage, function() {
            if ( self ) {
              self._toggleLoading(false);
            }
          });
        }
      },
      MessageDelete: function() {
        if ( app && app.currentMessage ) {
          app.removeMessage(self, function() {
            app.sync(self);
          });
        }
      },
      MessageMove: function() {
        if ( app && app.currentMessage ) {
          createMoveMenu(ev);
        }
      },

      MessageMarkRead: function() {
        app.markMessage('read', self, function(err, res, id, state) {
          if ( !err && res ) {
            toggleMessageState(id, state);
          }
        });
      },

      MessageMarkUnread: function() {
        app.markMessage('unread', self, function(err, res, id, state) {
          if ( !err && res ) {
            toggleMessageState(id, state);
          }
        });
      },

      MessageMarkStarred: function() {
        app.markMessage('starred', self, function(err, res, id, state) {
          if ( !err && res ) {
            toggleMessageState(id, state);
          }
        });
      },

      MessageMarkUnstar: function() {
        app.markMessage('unstar', self, function(err, res, id, state) {
          if ( !err && res ) {
            toggleMessageState(id, state);
          }
        });
      },

      OpenSettings: function() {
        if ( app ) {
          app.openSettingsWindow(self);
        }
      },

      ForceUpdate: function() {
        if ( app ) {
          app.forceSync(self);
        }
      },

      GetMessages: function() {
        app.sync(self);
      },

      OpenContacts: function() {
        app.openContacts();
      }

    };

    function menuEvent(ev) {
      if ( menuMap[ev.detail.id] ) {
        menuMap[ev.detail.id]();
      }
    }

    scheme.find(this, 'SubmenuFile').on('select', menuEvent);
    var folderMenu = scheme.find(this, 'SubmenuFolder').on('select', menuEvent);
    var messageMenu = scheme.find(this, 'SubmenuMessages').on('select', menuEvent);
    scheme.find(this, 'SubmenuMarkAs').on('select', menuEvent);
    scheme.find(this, 'SubmenuOptions').on('select', menuEvent);

    /*
     * ON RENDER:
        if ( row && iter ) {
          toggleMessageState(iter.id, iter.state, row);
        }
     */

    scheme.find(this, 'Folders').on('select', function(ev) {
    }).on('activate', function(ev) {
      var item = ev.detail.entries[0].data;
      app.setFolder(item);
    }).on('contextmenu', function(ev) {
      folderMenu.show(ev);
    });

    scheme.find(this, 'Messages').on('select', function(ev) {
      var item = ev.detail.entries[0].data;
      app.setMessage(item.id);
    }).on('activate', function(ev) {
      var item = ev.detail.entries[0].data;

      app.openMessageWindow({
        id: item.id,
        subject: item.subject,
        sender: item.sender,
        onRecieved: function() {
          toggleReadState(item.id);
        }
      });
    }).on('contextmenu', function(ev) {
      messageMenu.show(ev);
    });

    return root;
  };

  ApplicationGmailWindow.prototype.updateStatusBar = function(args) {
    args = args || {};

    var percentage = typeof args.progress === 'undefined' ? -1 : args.progress;
    var message = args.message || '';

    var statusbar = this._scheme.find(this, 'Statusbar');
    statusbar.set('value', message);

    var progressBar = this._scheme.find(this, 'Progressbar');
    progressBar.set('value', percentage);
    if ( percentage < 0 ) {
      progressBar.hide();
    } else {
      progressBar.show();
    }
  };

  ApplicationGmailWindow.prototype.updateTitleBar = function(args) {
    args = args || {};
    this._setTitle(this._opts.title + ' - ' + args.name);
  };

  ApplicationGmailWindow.prototype.renderMessages = function(messages, current) {
    var list = [];
    (messages || []).forEach(function(i) {
      list.push({
        value: i,
        columns: [
          {label: ''},
          {label: ''},
          {label: i.sender},
          {label: i.subject},
          {label: i.date}
        ]
      });
    });

    var view = this._scheme.find(this, 'Messages');
    view.clear();
    view.add(list);
    //view.set('value', selected); // FIXME
  };

  ApplicationGmailWindow.prototype.renderFolders = function(folders, current) {
    var view = this._scheme.find(this, 'Folders');
    view.clear();
    view.add(resolveFolders(folders, current));
    //view.set('value', current); // FIXME
  };

  ApplicationGmailWindow.prototype.setSelectedFolder = function(id) {
    var view = this._scheme.find(this, 'Folders');
    //view.set('value', id); // FIXME
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationGmail = OSjs.Applications.ApplicationGmail || {};
  OSjs.Applications.ApplicationGmail.MainWindow = ApplicationGmailWindow;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
