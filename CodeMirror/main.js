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

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Main Window Constructor
   */
  var ApplicationCodeMirrorWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationCodeMirrorWindow', {width: 800, height: 400}, app]);

    this.textarea     = null;
    this.container    = null;
    this.editor       = null;
    this.currentFile  = null;
    this.currentType  = null;
    this.hasChanged   = false;
    this.title        = metadata.name;

    // Set window properties and other stuff here
    this._title                 = this.title;
    this._icon                  = metadata.icon;
    this._properties.allow_drop = true;
  };

  ApplicationCodeMirrorWindow.prototype = Object.create(Window.prototype);

  //
  // Window methods
  //

  ApplicationCodeMirrorWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
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
        menu.setItemDisabled("Save", self.currentFile ? false : true);
      } else if ( item == "Run" ) {
        self.run();
      }
    };

    this._addGUIElement(new OSjs.GUI.Textarea('TextpadTextarea'), root);

    this.container = document.createElement('div');
    this.container.className = 'CodeContainer';

    this.textarea = document.createElement('textarea');
    this.textarea.innerHTML = '';
    this.container.appendChild(this.textarea);
    root.appendChild(this.container);

    return root;
  };

  ApplicationCodeMirrorWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);

    var self = this;
    if ( this.textarea ) {
      this.editor = CodeMirror.fromTextArea(this.textarea, {
        lineNumbers:      true,
        textWrapping:     false,
        indentUnit:       2,
        height:           "100%",
        fontSize:         "9pt",
        autoMatchParens:  true,
        readOnly:         false
      });

      var _update = function() {
        self.editor.refresh();
      };

      this._addHook('resize',   _update);
      this._addHook('resized',  _update);
      this._addHook('maximize', _update);
      this._addHook('restore',  _update);

      this.editor.on('change', function() {
        self.hasChanged = true;
      });
    }

    this.setCode(null, null, null);
  };

  ApplicationCodeMirrorWindow.prototype._onDndEvent = function(ev, type, item, args) {
    if ( !Window.prototype._onDndEvent.apply(this, arguments) ) return;

    if ( type === 'itemDrop' && item ) {
      var data = item.data;
      if ( data && data.type === 'file' && data.mime ) {
        this._appRef.defaultAction('open', data.path, data.mime);
      }
    }
  };

  ApplicationCodeMirrorWindow.prototype._focus = function () {
    if (!Window.prototype._focus.apply(this, arguments)) { return false; }

    if ( this.editor ) {
      this.editor.getInputField().focus();
    }

    return true;
  };

  ApplicationCodeMirrorWindow.prototype._blur = function () {
    if (!Window.prototype._blur.apply(this, arguments)) { return false; }

    if ( this.editor ) {
      this.editor.getInputField().blur();
    }

    return true;
  };

  ApplicationCodeMirrorWindow.prototype._close = function() {
    var self = this;
    var callback = function() {
      self._close();
    };

    if ( this.checkChanged(callback) !== false ) {
      return false;
    }
    return Window.prototype._close.apply(this, arguments);
  };

  ApplicationCodeMirrorWindow.prototype.destroy = function() {
    // Destroy custom objects etc. here
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

    Window.prototype.destroy.apply(this, arguments);
  };

  //
  // Editor methods
  //

  ApplicationCodeMirrorWindow.prototype.update = function(path, mime, save) {
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

    var title = this.title + ' - ' + (this.currentFile ? OSjs.Utils.filename(this.currentFile) : 'New File');
    title += ' [' + (this.currentType ? this.currentType : 'Unknown type') + ']';
    this._setTitle(title);

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
  };

  ApplicationCodeMirrorWindow.prototype.setCode = function(path, mime, contents) {
    contents = contents || '';

    if ( this.editor ) {
      this.editor.setValue(contents);
    }
    this.update(path, mime);
  };

  ApplicationCodeMirrorWindow.prototype.getCode = function() {
    if ( this.editor ) {
      return this.editor.getValue();
    }
    return '';
  };

  ApplicationCodeMirrorWindow.prototype.run = function() {
    var code = this.getCode();
  };

  ApplicationCodeMirrorWindow.prototype.checkChanged = function(callback, msg) {
    var self = this;
    if ( this.hasChanged ) {
      return this._appRef.defaultConfirmClose(this, msg, function() {
        self.hasChanged = false;
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
    this.acceptMime           = ['text\\/plain', 'text\\/html', 'text\\/xml', 'application\\/javascript', 'application\\/x\-python'];
    this.getSaveData          = function() {
      var w = self._getWindow('ApplicationCodeMirrorWindow');
      return w ? w.getCode() : null;
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
      var _new = function() {
        w.setCode(null, null, null);
      };
      var _open = function() {
        if ( arg2.mime ) {
          var t = self.acceptMime;
          var f = false;
          for ( var i = 0; i < t.length; i++ ) {
            if ( (new RegExp(t[i])).test(arg2.mime) ) {
              f = true;
              break;
            }
          }

          if ( !f ) {
            throw "Invalid file type: " + arg2.mime;
          }
        }
        w.setCode(arg2.path, arg2.mime, arg1);
      };

      if ( w ) {
        var msg = "Discard current document ?";
        if ( action === 'open' ) {
          if ( w.checkChanged(function() { _open(); }, msg) === false ) {
            _open();
          }
        } else if ( action === 'new' ) {
          if ( w.checkChanged(function() { _new(); }, msg) === false ) {
            _new();
          }
        } else if ( action === 'save' ) {
          w.update(arg1.path, arg1.mime, true);
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
