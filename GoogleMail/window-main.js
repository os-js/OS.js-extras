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

  var ApplicationGmailWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationGmailWindow', {
      icon: metadata.icon,
      title: metadata.name + ' v0.5',
      min_width: 500,
      min_height: 400,
      width: 600,
      height: 400
    }, app]);

    this.folderView = null;
    this.messageView = null;
    this.statusBar = null;
    this.progressBar = null;
  };

  ApplicationGmailWindow.prototype = Object.create(Window.prototype);

  ApplicationGmailWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    var vboxMain = this._addGUIElement(new GUI.VBox('ApplicationGmailVboxMain'), root);
    var container;
    var menuBar, statusBar, progressBar;
    var panedView, viewFolders, folderView, viewMessages, messageView;

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

    //
    // Menu Bar
    //
    container = vboxMain.insert('MenuBar', 0, 1);
    menuBar = this._addGUIElement(new GUI.MenuBar('ApplicationGmailMenuBar'), container);
    menuBar.addItem(API._('LBL_FILE'), [
      {title: API._('LBL_CLOSE'), name: 'Close', onClick: function() {
        self._close();
      }}
    ]);
    menuBar.addItem(API._('Folder'), [
      {title: API._('LBL_NEW'), name: 'NewFolder', onClick: function() {
        var sel = folderView ? folderView.getSelected() : null;
        if ( app && sel && sel.id ) {
          app.createFolder(self, sel.id, sel.title);
        }
      }},
      {title: API._('LBL_RENAME'), name: 'RenameFolder', onClick: function() {
        var sel = folderView ? folderView.getSelected() : null;
        if ( app && sel && sel.id ) {
          app.renameFolder(self, sel.id, sel.title);
        }
      }},
      {title: API._('LBL_DELETE'), name: 'DeleteFolder', onClick: function() {
        var sel = folderView ? folderView.getSelected() : null;
        if ( app && sel && sel.id ) {
          app.removeFolder(self, sel.id, sel.title);
        }
      }},
    ]);
    menuBar.addItem(API._('Message'), [
      {title: API._('LBL_NEW'), name: 'New', onClick: function() {
        if ( app ) {
          app.openMessageWindow();
        }
      }},
      {title: API._('Reply'), name: 'Reply', onClick: function() {
        if ( app && app.currentMessage ) {
          self._toggleLoading(true);
          app.replyToMessage(app.currentMessage, function() {
            if ( self ) {
              self._toggleLoading(false);
            }
          });
        }
      }},
      {title: API._('LBL_DELETE'), name: 'Delete', onClick: function() {
        if ( app && app.currentMessage ) {
          app.removeMessage(self, function() {
            app.sync(self);
          });
        }
      }},
      {title: API._('LBL_MOVE'), name: 'Move', onClick: function(ev) {
        if ( app && app.currentMessage ) {
          createMoveMenu(ev);
        }
      }},
      {title: API._('Mark as'), name: 'MarkAs', menu: [
        {
          title: 'Read',
          onClick: function() {
            app.markMessage('read', self, function(err, res, id, state) {
              if ( !err && res ) {
                toggleMessageState(id, state);
              }
            });
          }
        },
        {
          title: 'Unread',
          onClick: function() {
            app.markMessage('unread', self, function(err, res, id, state) {
              if ( !err && res ) {
                toggleMessageState(id, state);
              }
            });
          }
        },
        {
          title: 'Starred',
          onClick: function() {
            app.markMessage('starred', self, function(err, res, id, state) {
              if ( !err && res ) {
                toggleMessageState(id, state);
              }
            });
          }
        },
        {
          title: 'Unstar',
          onClick: function() {
            app.markMessage('unstar', self, function(err, res, id, state) {
              if ( !err && res ) {
                toggleMessageState(id, state);
              }
            });
          }
        }
      ]}
    ]);
    menuBar.addItem('Get messages', []);
    menuBar.addItem('Open contacts', []);
    menuBar.addItem(API._('LBL_OPTIONS'), [
      {title: API._('LBL_SETTINGS'), name: 'Settings', onClick: function() {
        if ( app ) {
          app.openSettingsWindow(self);
        }
      }},
      {title: API._('Force update'), name: 'ForceSync', onClick: function() {
        if ( app ) {
          app.forceSync(self);
        }
      }}
    ]);

    menuBar.onMenuOpen = function(menu, mpos, mtitle, menuBar) {
      if ( mtitle === 'Get messages' && app ) {
        app.sync(self);
      } else if ( mtitle === 'Open contacts' && app ) {
        app.openContacts();
      } else if ( mtitle === API._('Message') ) {
        var disabled = !(app && app.currentMessage);
        menu.setItemDisabled('Reply', disabled);
        menu.setItemDisabled('Delete', disabled);
        menu.setItemDisabled('Move', disabled);
        menu.setItemDisabled('MarkAs', disabled);

      } else if ( mtitle === API._('Folder') ) {
        var sel = folderView ? folderView.getSelected() : null;
        if ( app && sel && sel.id ) {
          menu.setItemDisabled('RenameFolder', false);
          menu.setItemDisabled('DeleteFolder', false);
        } else {
          menu.setItemDisabled('RenameFolder', true);
          menu.setItemDisabled('DeleteFolder', true);
        }
      }
    };

    //
    // Main View
    //
    container = vboxMain.insert('PanedView', 1, 0);
    panedView = this._addGUIElement(new GUI.PanedView('ApplicationGmailPanedView'), container);

    // Folder View
    viewFolders = panedView.createView('Folders', {width: 222});
    folderView = this._addGUIElement(new GUI.TreeView('ApplicationGmailFolderView', {
      /*
      onSelect: function(ev, el, item) {
        if ( app && item ) {
          app.setFolder(item.id);
        }
      },
      */
      singleClick: true,
      expanded: true,
      onContextMenu: function(ev, el, item) {
        if ( menuBar ) {
          menuBar.createContextMenu(ev, 1);
        }
      },
      onActivate: function(ev, el, item) {
        if ( app && item ) {
          app.setFolder(item.id);
        }
      }
    }), viewFolders);

    // Message View
    viewMessages = panedView.createView('Messages');
    messageView = this._addGUIElement(new GUI.ListView('ApplicationGmailMessageView', {
      onRenderItem: function(row, iter, colref) {
        if ( row && iter ) {
          toggleMessageState(iter.id, iter.state, row);
        }
      },
      onActivate: function(ev, el, item) {
        if ( app && item ) {
          app.openMessageWindow({
            id: item.id,
            subject: item.subject,
            sender: item.sender,
            onRecieved: function() {
              toggleReadState(item.id);
            }
          });
        }
      },
      onContextMenu: function(ev, el, item) {
        if ( menuBar ) {
          menuBar.createContextMenu(ev, 2);
        }
      },
      onSelect: function(ev, el, item) {
        if ( app && item ) {
          app.setMessage(item.id);
        }
      }
    }), viewMessages);
    messageView.setColumns([
      {key: 'id', title: 'ID', width: 100, visible: false},
      {key: 'state', title: '', width: 16, visible: false},
      {key: 'unread', title: '', width: 16},
      {key: 'starred', title: '', width: 16},
      {key: 'sender', title: 'Sender'},
      {key: 'subject', title: 'Subject'},
      {key: 'date', title: 'Date', width: 75}
    ]);

    //
    // Status Bar
    //
    container = vboxMain.insert('StatusBar', 0, 1);
    statusBar = this._addGUIElement(new GUI.StatusBar('ApplicationGmailStatusBar'), container);
    progressBar = this._addGUIElement(new GUI.ProgressBar('ApplicationGmailProgresBar'), statusBar.$element);

    this.folderView = folderView;
    this.messageView = messageView;
    this.statusBar = statusBar;
    this.progressBar = progressBar;

    return root;
  };

  ApplicationGmailWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);
  };

  ApplicationGmailWindow.prototype.destroy = function() {
    Window.prototype.destroy.apply(this, arguments);

    this.folderView = null;
    this.messageView = null;
    this.statusBar = null;
    this.progressBar = null;
  };

  ApplicationGmailWindow.prototype.updateStatusBar = function(args) {
    args = args || {};

    var percentage = typeof args.progress === 'undefined' ? -1 : args.progress;
    var message = args.message || '';

    if ( this.statusBar ) {
      this.statusBar.setText(message);
    }

    if ( this.progressBar ) {
      this.progressBar.setPercentage(percentage);
      if ( percentage < 0 ) {
        this.progressBar.$element.style.display = 'none';
      } else {
        this.progressBar.$element.style.display = 'block';
      }
    }

  };

  ApplicationGmailWindow.prototype.updateTitleBar = function(args) {
    args = args || {};
    this._setTitle(this._opts.title + ' - ' + args.name);
  };

  ApplicationGmailWindow.prototype.renderMessages = function(messages, current) {
    messages = messages || [];
    if ( this.messageView ) {
      var list = [];
      (messages || []).forEach(function(i) {
        list.push({
          id: i.id,
          state: i.state,
          subject: i.subject,
          sender: i.sender,
          date: i.date
        });
      });

      this.messageView.setRows(list);
      this.messageView.render();

      if ( current ) {
        this.messageView.setSelected(current, 'id', true);
      }
    }
  };

  ApplicationGmailWindow.prototype.renderFolders = function(folders, current) {
    function resolveFolders() {
      var fiters = [];
      var items = [];

      folders.forEach(function(i) {
        if ( i.name.match(/^CATEGORY_/) ) {
          return;
        }

        if ( i.name.match(/^(\[Imap\]|CHAT|DRAFT|UNREAD|INBOX|TRASH|IMPORTANT|STARRED|SPAM|SENT)/) ) {
          items.push({
            title: i.name,
            id: i.id,
            icon: OSjs.API.getIcon('places/folder.png')
          });
        } else {
          fiters.push({
            title: i.name,
            id: i.id,
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
        title: '[Google]',
        id: null,
        icon: OSjs.API.getIcon('places/folder.png'),
        items: items
      });

      return fiters;
    }

    if ( this.folderView ) {
      this.folderView.setData(resolveFolders());
      this.folderView.render();
      this.folderView.setSelected(current, 'id', true);
    }
  };

  ApplicationGmailWindow.prototype.setSelectedFolder = function(id) {
    if ( this.folderView ) {
      this.folderView.setSelected(id, 'id', true);
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationGmail = OSjs.Applications.ApplicationGmail || {};
  OSjs.Applications.ApplicationGmail.MainWindow = ApplicationGmailWindow;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
