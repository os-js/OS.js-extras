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
const ace = window.ace || {};

const DefaultApplication = OSjs.require('helpers/default-application');
const DefaultApplicationWindow = OSjs.require('helpers/default-application-window');
const Utils = OSjs.require('utils/misc');

class ApplicationAceEditorWindow extends DefaultApplicationWindow {
  constructor(app, metadata, file) {
    super('ApplicationAceEditorWindow', {
      allow_drop: true,
      icon: metadata.icon,
      title: metadata.name,
      width: 500,
      height: 500
    }, app, file);

    this.editor = null;
    this._on('destroy', () => (this.editor = null));
    this._on('resize', () => {
      if ( this.editor ) {
        this.editor.resize();
      }
    });
    this._on('blur', () => {
      if ( this.editor ) {
        this.editor.blur();
      }
    });
    this._on('focus', () => {
      if ( this.editor ) {
        this.editor.focus();
      }
    });
  }

  init(wmRef, app) {
    if ( typeof window.__aceEditorCount === 'undefined' ) {
      window.__aceEditorCount = 0;
    }

    const root = super.init(...arguments);

    // Load and set up scheme (GUI) here
    this._render('AceEditorWindow', require('osjs-scheme-loader!scheme.html'));

    var editor;
    var statusbar = this._find('Statusbar');
    var container = this._find('AceContainer').$element;
    var id = 'AceEditor' + window.__aceEditorCount.toString();

    container.id = id;

    function updateStatusbar() {
      var c = editor.selection.getCursor();
      var l = editor.session.getLength();
      var txt = Utils.format('Row: {0}, Col: {1}, Lines: {2}', c.row, c.column, l);
      statusbar.set('value', txt);
    }

    editor = this.editor = ace.edit(id);
    this.editor.setTheme('ace/theme/monokai');
    this.editor.getSession().setMode('ace/mode/javascript');
    this.editor.getSession().selection.on('changeCursor', function(e) {
      updateStatusbar();
    });
    updateStatusbar();

    window.__aceEditorCount++;

    return root;
  }

  updateFile(file) {
    super.updateFile(...arguments);
    if ( this.editor ) {
      this.setSyntaxMode(file);

      this.editor.focus();
    }
  }

  showFile(file, content) {
    this.editor.setValue(content || '');
    super.showFile(...arguments);

    this.setSyntaxMode(file);
  }

  getFileData() {
    return this.editor.getValue();
  }

  setSyntaxMode(file) {
    if ( !this.editor || !file ) {
      return;
    }

    var mode = 'text';
    if ( file.filename.match(/\.js$/i) ) {
      mode = 'javascript';
    } else if ( file.filename.match(/\.py$/i) ) {
      mode = 'python';
    } else if ( file.filename.match(/\.css$/i) ) {
      mode = 'css';
    } else if ( file.filename.match(/\.x?html?$/i) ) {
      mode = 'html';
    }

    this.editor.session.setMode({
      path: 'ace/mode/' + mode,
      v: Date.now()
    });
  }

}

class ApplicationAceEditor extends DefaultApplication {

  constructor(args, metadata) {
    super('ApplicationAceEditor', args, metadata, {
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
    });
  }

  init(settings, metadata) {
    super.init(...arguments);

    const path = this._getResource('ace');
    ace.config.set('basePath', path);
    /*
    ace.config.set('modePath', '/path/to/src');
    ace.config.set('workerPath', '/path/to/src');
    ace.config.set('themePath', '/path/to/src');
    */

    const file = this._getArgument('file');
    this._addWindow(new ApplicationAceEditorWindow(this, metadata, file));
  }
}

OSjs.Applications.ApplicationAceEditor = ApplicationAceEditor;

