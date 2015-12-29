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
(function(DefaultApplication, DefaultApplicationWindow, Application, Window, Utils, API, VFS, GUI) {
  'use strict';
  var globalCounter = 0;

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationAceEditorWindow(app, metadata, scheme, file) {
    DefaultApplicationWindow.apply(this, ['ApplicationAceEditorWindow', {
      allow_drop: true,
      icon: metadata.icon,
      title: metadata.name,
      width: 500,
      height: 500
    }, app, scheme, file]);

    this.editor = null;
  }

  ApplicationAceEditorWindow.prototype = Object.create(DefaultApplicationWindow.prototype);
  ApplicationAceEditorWindow.constructor = DefaultApplicationWindow.prototype;

  ApplicationAceEditorWindow.prototype.init = function(wmRef, app, scheme) {
    var root = DefaultApplicationWindow.prototype.init.apply(this, arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    scheme.render(this, 'AceEditorWindow', root);
    var statusbar = scheme.find(this, 'Statusbar');

    var container = scheme.find(this, 'AceContainer').$element;
    var id = 'AceEditor' + globalCounter.toString();

    container.id = id;

    function updateStatusbar() {
      var c = editor.selection.getCursor();
      var l = editor.session.getLength();
      var txt = Utils.format('Row: {0}, Col: {1}, Lines: {2}', c.row, c.column, l);
      statusbar.set('value', txt);
    }

    var editor = this.editor = ace.edit(id);
    this.editor.setTheme('ace/theme/monokai');
    this.editor.getSession().setMode('ace/mode/javascript');
    this.editor.getSession().selection.on('changeCursor', function(e) {
      updateStatusbar();
    });
    updateStatusbar();

    globalCounter++;

    return root;
  };

  ApplicationAceEditorWindow.prototype.destroy = function() {
    this.editor = null;
    Window.prototype.destroy.apply(this, arguments);
  };

  ApplicationAceEditorWindow.prototype.updateFile = function(file) {
    DefaultApplicationWindow.prototype.updateFile.apply(this, arguments);
    this.editor.focus();
  };

  ApplicationAceEditorWindow.prototype.showFile = function(file, content) {
    this.editor.setValue(content || '');
    DefaultApplicationWindow.prototype.showFile.apply(this, arguments);
  };

  ApplicationAceEditorWindow.prototype.getFileData = function() {
    return this.editor.getValue();
  };

  ApplicationAceEditorWindow.prototype._resize = function() {
    if ( DefaultApplicationWindow.prototype._resize.apply(this, arguments) ) {
      if ( this.editor ) {
        this.editor.resize();
      }
      return true;
    }
    return false;
  };


  ApplicationAceEditorWindow.prototype._blur = function() {
    if ( DefaultApplicationWindow.prototype._blur.apply(this, arguments) ) {
      if ( this.editor ) {
        this.editor.blur();
      }
      return true;
    }
    return false;
  };

  ApplicationAceEditorWindow.prototype._focus = function() {
    if ( DefaultApplicationWindow.prototype._focus.apply(this, arguments) ) {
      if ( this.editor ) {
        this.editor.focus();
      }
      return true;
    }
    return false;
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationAceEditor(args, metadata) {
    DefaultApplication.apply(this, ['ApplicationAceEditor', args, metadata, {
      extension: 'txt',
      mime: 'text/plain',
      filename: 'New ace file.txt',
      filetypes: [
        {
          label: 'Plain Text',
          mime: 'text/plain',
          extension: 'txt'
        },
        {
          label: 'JavaScript',
          mime: 'application/javascript',
          extension: 'js'
        },
        {
          label: 'CSS',
          mime: 'text/css',
          extension: 'css'
        },
        {
          label: 'HTML',
          mime: 'text/html',
          extension: 'html'
        },
        {
          label: 'XML',
          mime: 'application/xml',
          extension: 'xml'
        },
        {
          label: 'Python',
          mime: 'application/x-python',
          extension: 'py'
        },
        {
          label: 'PHP',
          mime: 'application/php',
          extension: 'php'
        }
      ]
    }]);
  }

  ApplicationAceEditor.prototype = Object.create(DefaultApplication.prototype);
  ApplicationAceEditor.constructor = DefaultApplication;

  ApplicationAceEditor.prototype.init = function(settings, metadata, onInited) {
    var self = this;

    var path = API.getApplicationResource(this, 'vendor/ace/build/src');
    ace.config.set('basePath', path);
    /*
    ace.config.set('modePath', '/path/to/src');
    ace.config.set('workerPath', '/path/to/src');
    ace.config.set('themePath', '/path/to/src');
    */

    DefaultApplication.prototype.init.call(this, settings, metadata, onInited, function(scheme, file) {
      self._addWindow(new ApplicationAceEditorWindow(self, metadata, scheme, file));
    });
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationAceEditor = OSjs.Applications.ApplicationAceEditor || {};
  OSjs.Applications.ApplicationAceEditor.Class = ApplicationAceEditor;

})(OSjs.Helpers.DefaultApplication, OSjs.Helpers.DefaultApplicationWindow, OSjs.Core.Application, OSjs.Core.Window, OSjs.Utils, OSjs.API, OSjs.VFS, OSjs.GUI);
