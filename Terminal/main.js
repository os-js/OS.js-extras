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
import PTYTerminal from './pty.js';

const Utils = OSjs.require('utils/misc');
const Window = OSjs.require('core/window');
const Application = OSjs.require('core/application');

class ApplicationTerminalWindow extends Window {

  constructor(app, metadata) {
    super('ApplicationTerminalWindow', {
      icon: metadata.icon,
      title: metadata.name,
      width: 960,
      height: 288,
      key_capture : true
    }, app);

    this.previousTitle = null;
    this.terminal = new PTYTerminal(metadata.config.host.replace('%HOST%', window.location.hostname));
    this.inited = false;
  }

  init(wmRef, app) {
    var root = super.init(...arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    this._render('TerminalWindow', require('osjs-scheme-loader!scheme.html'));

    function resize() {
      var size = self.getTerminalSize();
      if ( self.terminal ) {
        self.terminal.resize(size.cols, size.rows);
      }
    }

    this._on('resized', function() {
      resize();
    });

    this._on('maximize', function() {
      resize();
    });

    this._on('restore', function() {
      resize();
    });

    this.terminal.on('destroyed', function() {
      self._close();
    });

    this.terminal.on('connected', function() {
      resize();
    });

    this.terminal.on('title', function(title) {
      self.setTitle(title);
    });

    var size = this.getTerminalSize();

    this.inited = this.terminal.init(this._$root, {
      rows: size.rows,
      cols: size.cols
    });

    return root;
  }

  _inited() {
    super._inited(...arguments);

    if ( this.inited ) {
      this.terminal.connect();
    }
  }

  destroy() {
    if ( super.destroy(...arguments) ) {
      if ( this.terminal ) {
        this.terminal.destroy();
      }
      this.terminal = null;
      return true;
    }

    return false;
  }

  blur() {
    if ( super.blur(...arguments) ) {
      if ( this.terminal ) {
        this.terminal.blur();
      }
      return true;
    }
    return false;
  }

  focus() {
    if ( super.focus(...arguments) ) {
      if ( this.terminal ) {
        this.terminal.focus();
      }
      return true;
    }
    return false;
  }

  _onKeyEvent(ev, type) {
    super._onKeyEvent(...arguments);

    if ( this.terminal ) {
      this.terminal.event(type, ev);
      return false;
    }

    return true;
  }

  setTitle(t) {
    var title = t;
    if ( this.terminal ) {
      var s = this.getTerminalSize();
      title += Utils.format(' [{0}x{1}]', s.cols, s.rows);
    }

    if ( title !== this.previousTitle ) {
      this._setTitle(title, true);
    }

    this.previousTitle = title;
  }

  getTerminalSize() {
    return {
      cols: parseInt(Math.max(this._dimension.w / 7), 10),
      rows: parseInt(Math.min(this._dimension.h / 14), 10)
    };
  }
}

class ApplicationTerminal extends Application {

  constructor(args, metadata) {
    super('ApplicationTerminal', args, metadata);
  }

  init(settings, metadata) {
    super.init(...arguments);

    this._addWindow(new ApplicationTerminalWindow(this, metadata));
  }
}

OSjs.Applications.ApplicationTerminal = ApplicationTerminal;

