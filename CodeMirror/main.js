/*!
 * OS.js - JavaScript Operating System
 *
 * Copyright (c) 2011-2013, Anders Evenrud <andersevenrud@gmail.com>
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
(function(Application, Window, GUI, Dialogs) {

  var EditorTab = function() {
    this.textarea     = null;
    this.container    = null;
    this.editor       = null;
    this.currentFile  = null;
    this.currentType  = null;
    this.hasChanged   = false;
    this.tab          = null;
  };

  EditorTab.prototype.init = function(root, tab) {
    this.tab = tab;

    this.container = document.createElement('div');
    this.container.className = 'CodeContainer';

    this.textarea = document.createElement('textarea');
    this.textarea.innerHTML = '';
    this.container.appendChild(this.textarea);
    root.appendChild(this.container);

    this.editor = CodeMirror.fromTextArea(this.textarea, {
      lineNumbers:      true,
      textWrapping:     false,
      indentUnit:       2,
      height:           "100%",
      fontSize:         "9pt",
      autoMatchParens:  true,
      readOnly:         false
    });

    var self = this;
    this.editor.on('change', function() {
      self.setChanged(true);
    });
  };

  EditorTab.prototype.refresh = function() {
    if ( this.editor ) {
      this.editor.refresh();
    }
  };

  EditorTab.prototype.destroy = function(guiTab) {
    if ( this.textarea ) {
      if ( this.textarea.parentNode ) {
        this.textarea.parentNode.removeChild(this.textarea);
      }
      this.textarea = null;
    }
    if ( this.container ) {
      if ( this.container.parentNode ) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
    }
    if ( this.editor ) {
      this.editor = null;
    }
    if ( this.tab && guiTab ) {
      var idx = OSjs.Utils.$index(this.tab, this.tab.parentNode);
      if ( idx >= 0 ) {
        guiTab.removeTab(idx);
      }
    }
  };

  EditorTab.prototype.update = function(path, mime, save) {
    var self = this;

    // Force new type from extension
    if ( save && /*!mime &&*/ path ) {
      var fname = OSjs.Utils.filename(path);
      if ( fname.match(/\.js$/) ) {
        mime = 'application/javascript';
      } else if ( fname.match(/\.py$/) ) {
        mime = 'application/x-python';
      } else if ( fname.match(/\.html$/) ) {
        mime = 'text/html';
      } else if ( fname.match(/\.xml$/) ) {
        mime = 'text/xml';
      } else if ( fname.match(/\.txt$/) ) {
        mime = 'text/plain';
      }
    }

    var type = null;
    switch ( mime ) {
      case 'application/x-python' :
        type = 'python';
      break;
      case 'text/html' :
        type = 'html';
      break;
      case 'text/xml' :
        type = 'xml';
      break;
      case 'text/plain' :
        type = 'text';
      break;
      case 'application/javascript' :
        type = 'javascript';
      break;
      default :
        if ( mime !== null ) {
          throw "Invalid file type";
        }
      break;
    }

    this.currentType = type;
    this.currentFile = path || null;
    this.hasChanged  = false;

    if ( this.editor ) {
      var t = 'text';
      if ( this.currentType ) {
        t = this.currentType === 'html' ? 'xml' : this.currentType;
      }
      this.editor.setOption("mode", t);

      setTimeout(function() {
        self.editor.refresh();
      }, 0);
    }

    if ( this.tab ) {
      this.tab.firstChild.innerHTML = this.getTitle(true) || 'New File';
    }
  };

  EditorTab.prototype.setCode = function(path, mime, contents) {
    contents = contents || '';

    if ( this.editor ) {
      this.editor.setValue(contents);
    }
    this.update(path, mime);
  };

  EditorTab.prototype.getCode = function() {
    if ( this.editor ) {
      return this.editor.getValue();
    }
    return '';
  };

  EditorTab.prototype.getTitle = function(shorthand) {
    if ( shorthand ) {
      return OSjs.Utils.filename(this.currentFile || 'New file');
    }
    return OSjs.Utils.filename(this.currentFile || 'New file' ) + ' [' + (this.currentType || 'unknown') + ']';
  };

  EditorTab.prototype.setChanged = function(c) {
    if ( this.tab ) {
      if ( c != this.hasChanged ) {
        if ( c ) {
          if ( !this.tab.firstChild.innerHTML.match(/ \*$/) ) {
            this.tab.firstChild.innerHTML += ' *';
          }
        } else {
          if ( this.tab.firstChild.innerHTML.match(/ \*$/) ) {
            this.tab.firstChild.innerHTML = this.tab.firstChild.innerHTML.replace(/ \*$/, '');
          }
        }
      }
    }
    this.hasChanged = c;
  };

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  var DefaultApplicationWindow = OSjs.Helpers.DefaultApplicationWindow;

  /**
   * Main Window Constructor
   */
  var ApplicationCodeMirrorWindow = function(app, metadata) {
    DefaultApplicationWindow.apply(this, ['ApplicationCodeMirrorWindow', {width: 800, height: 400}, app]);

    this.title        = metadata.name;
    this.tabs         = [/*
                        */];
    this.currentTab   = null;

    // Set window properties and other stuff here
    this._title                 = this.title;
    this._icon                  = metadata.icon;
    this._properties.allow_drop = true;
  };

  ApplicationCodeMirrorWindow.prototype = Object.create(DefaultApplicationWindow.prototype);

  //
  // Window methods
  //

  ApplicationCodeMirrorWindow.prototype.init = function(wmRef, app) {
    var root = DefaultApplicationWindow.prototype.init.apply(this, arguments);
    var self = this;

    // Create window contents (GUI) here

    var menuBar = this._addGUIElement(new OSjs.GUI.MenuBar('ApplicationCodeMirrorMenuBar'), root);
    menuBar.addItem("File", [
      {title: 'New', name: 'New', onClick: function() {
        app.defaultAction('new');
      }},
      {title: 'Open', name: 'Open', onClick: function() {
        app.defaultAction('open');
      }},
      {title: 'Save', name: 'Save', onClick: function() {
        app.defaultAction('save');
      }},
      {title: 'Save As...', name: 'SaveAs', onClick: function() {
        app.defaultAction('saveas');
      }},
      {title: 'Close', name: 'Close', onClick: function() {
        self._close();
      }}
    ]);
    /*
    menuBar.addItem("Run", []);
    */

    menuBar.onMenuOpen = function(menu, cpos, item) {
      if ( item == "File" ) {
        var cur = self.currentTab && self.currentTab.currentFile;
        menu.setItemDisabled("Save", !cur);
      } else if ( item == "Run" ) {
        self.run();
      }
    };

    this._addGUIElement(new OSjs.GUI.Tabs('ApplicationCodeMirrorTabs'), root);

    return root;
  };

  ApplicationCodeMirrorWindow.prototype._inited = function() {
    DefaultApplicationWindow.prototype._inited.apply(this, arguments);

    var self = this;
    var _update = function() {
      if ( this.currentTab ) {
        self.currentTab.refresh();
      }
    };

    this._addHook('resize',   _update);
    this._addHook('resized',  _update);
    this._addHook('maximize', _update);
    this._addHook('restore',  _update);

    this.initTabs();
  };

  ApplicationCodeMirrorWindow.prototype._focus = function () {
    if (!DefaultApplicationWindow.prototype._focus.apply(this, arguments)) { return false; }

    if ( this.editor ) {
      this.editor.getInputField().focus();
    }

    return true;
  };

  ApplicationCodeMirrorWindow.prototype._blur = function () {
    if (!DefaultApplicationWindow.prototype._blur.apply(this, arguments)) { return false; }

    if ( this.editor ) {
      this.editor.getInputField().blur();
    }

    return true;
  };

  ApplicationCodeMirrorWindow.prototype.destroy = function() {
    // Destroy custom objects etc. here

    this.clearTabs();

    DefaultApplicationWindow.prototype.destroy.apply(this, arguments);
  };

  //
  // Editor methods
  //

  ApplicationCodeMirrorWindow.prototype.initTabs = function() {
    if ( !this.tabs.length ) {
      this._setTitle(this.title);
      this.createTab();
    }
  };

  ApplicationCodeMirrorWindow.prototype.createTab = function(filename, mime, content) {
    var t = new EditorTab();
    var g = this._getGUIElement('ApplicationCodeMirrorTabs');

    var self = this;
    if ( g ) {
      var _onClose = function(ev, $t, $c, $close, idx) {
        if ( t.hasChanged ) {
          var msg = 'Close tab without saving changes?';

          self._toggleDisabled(true);
          self._appRef._createDialog('Confirm', [msg, function(btn) {
            self._toggleDisabled(false);
            if ( btn == "ok" ) {
              self.removeTab(t);
            }
          }]);
        } else {
          self.removeTab(t);
        }
      };

      var tab = g.addTab('New tab', {closeable: true, onClose: _onClose}, function() {
        self.currentTab = t;
        self.updateTab();
      });

      t.init(tab.content, tab.tab);
      t.setCode((filename || null), (mime || null), (content || null));

      var idx = OSjs.Utils.$index(tab.tab);
      if ( idx > 0 ) {
        g.setTab(idx);
      }
    }

    this.tabs.push(t);
  };

  ApplicationCodeMirrorWindow.prototype.removeTab = function(i) {
    var g = this._getGUIElement('ApplicationCodeMirrorTabs');

    if ( i instanceof EditorTab ) {
      var found = -1;
      for ( var j = 0; j < this.tabs.length; j++ ) {
        if ( this.tabs[j] == i ) {
          found = j;
          break;
        }
      }

      if ( found >= 0 ) {
        this.tabs[found].destroy(g);
        this.tabs.splice(found, 1);
      }
    } else {
      if ( this.tabs[i] ) {
        this.tabs[i].destroy(g);
        this.tabs.splice(i, 1);
      }
    }

    this.initTabs();
  };

  ApplicationCodeMirrorWindow.prototype.updateTab = function(path, mime, save) {
    console.warn(this.currentTab, path, mime, save);
    if ( this.currentTab ) {
      if ( path && mime ) {
        this.currentTab.update(path, mime, save);
      }
      this._setTitle(this.title + ' - ' + this.currentTab.getTitle());
      this.currentTab.refresh();
    }
  };

  ApplicationCodeMirrorWindow.prototype.clearTabs = function() {
    var g = this._getGUIElement('ApplicationCodeMirrorTabs');

    var i = 0, l = this.tabs.length;
    for ( i; i < l; i++ ) {
      this.tabs[i].destroy(g);
    }
    this.tabs = [];
    this.currentTab = null;
  };

  ApplicationCodeMirrorWindow.prototype.getTabCode = function() {
    if ( this.currentTab ) {
      return this.currentTab.getCode();
    }
    return null;
  };

  ApplicationCodeMirrorWindow.prototype.checkTabChanges = function() {
    var i = 0, l = this.tabs.length;
    for ( i; i < l; i++ ) {
      if ( this.tabs[i].hasChanged ) {
        return true;
      }
    }
    return false;
  };

  ApplicationCodeMirrorWindow.prototype.checkChanged = function(callback, msg) {
    var self = this;
    if ( this.checkTabChanges() ) {
      return this._appRef.defaultConfirmClose(this, msg, function() {
        var i = 0, l = self.tabs.length;
        for ( i; i < l; i++ ) {
          self.tabs[i].setChanged(false);
        }

        callback();
      });
    }
    return false;
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application constructor
   */
  var ApplicationCodeMirror = function(args, metadata) {
    Application.apply(this, ['ApplicationCodeMirror', args, metadata]);
    var self = this;

    this.defaultActionWindow  = 'ApplicationCodeMirrorWindow';
    this.defaultFilename      = "New code.txt";
    this.defaultMime          = 'text/plain';
    this.acceptMime           = metadata.mime || null;
    this.getSaveData          = function() {
      var w = self._getWindow('ApplicationCodeMirrorWindow');
      return w ? w.getTabCode() : null;
    };

    this.defaultActionError = function(action, error) {
      var w = self._getWindow('ApplicationCodeMirrorWindow');
      var msg = "An error occured in action: " + action;
      if ( w ) {
        w._error("CodeMirror error", msg, error);
      } else {
        OSjs.API.error("CodeMirror error", msg, error);
      }
    };

    this.defaultActionSuccess = function(action, arg1, arg2) {
      var w = self._getWindow('ApplicationCodeMirrorWindow');
      if ( w ) {
        if ( action === 'open' ) {
          w.createTab(arg2.path, arg2.mime, arg1);
        } else if ( action === 'new' ) {
          w.createTab();
        } else if ( action === 'save' ) {
          w.updateTab(arg1.path, arg1.mime, true);
        }
        w._focus();
      }
    };
  };

  ApplicationCodeMirror.prototype = Object.create(Application.prototype);

  ApplicationCodeMirror.prototype.init = function(core, session, metadata) {
    this._addWindow(new ApplicationCodeMirrorWindow(this, metadata));
    Application.prototype.init.apply(this, arguments);
  };

  //
  // EXPORTS
  //
  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationCodeMirror = ApplicationCodeMirror;

})(OSjs.Helpers.DefaultApplication, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs);
//
// ^ This is important -- We implement 'DefaultApplication' from helpers not 'Application' from core
//
