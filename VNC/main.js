/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
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
// TODO: Clipboard
// TODO: Clip cursor

import RFB from './vendor/noVNC/core/rfb.js';
const Window = OSjs.require('core/window');
const Application = OSjs.require('core/application');

class ApplicationVNCWindow extends Window {
  constructor(app, metadata) {
    super('ApplicationVNCWindow', {
      icon: metadata.icon,
      title: metadata.name,
      width: 640,
      height: 480,
      key_capture: true // IMPORTANT
    }, app);

    this.connectionDialog = null;
    this.lastKeyboardinput = null;
    this.resizeTimeout = null;
  }

  init(wmRef, app) {
    var root = super.init(...arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    this._render('VNCWindow', require('osjs-scheme-loader!scheme.html'));

    var canvas = this._find('Canvas').$element.children[0];
    var menuMap = {
      MenuConnect: function() {
        app.connect(self, canvas);
      },
      MenuDisconnect: function() {
        app.disconnect(self);
      },
      MenuClose: function() {
        self._close();
      }
    };

    this._find('SubmenuFile').on('select', function(ev) {
      if ( menuMap[ev.detail.id] ) {
        menuMap[ev.detail.id]();
      }
    });

    this._on('blur', () => app.toggleFocus(false));
    this._on('focus', () => app.toggleFocus(true));

    return root;
  }

  destroy() {
    this.resizeTimeout = clearTimeout(this.resizeTimeout);
    return super.destroy(...arguments);
  }

  _resize() {
    if ( super._resize(...arguments) ) {
      if ( this._app && this._app.rfb ) {
        var rfb = this._app.rfb;
        var display = rfb.get_display();

        if ( display ) {
          var scaletype = this._app.connectionSettings.scaling;
          var canvas = this._find('Canvas').$element;

          var size = {
            w: canvas.offsetWidth,
            h: canvas.offsetHeight
          };

          if ( scaletype === 'remote' ) {
            this.resizeTimeout = clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(function() {
              if ( display ) {
                display.set_maxWidth(size.w);
                display.set_maxHeight(size.h);
                rfb.setDesktopSize(size.w, size.h);
              }
            }, 500);

          } else if ( scaletype === 'scale' || scaletype === 'downscale' ) {
            var downscaleOnly = scaletype === 'downscale';
            var scaleRatio = display.autoscale(size.w, size.h, downscaleOnly);
            rfb.get_mouse().set_scale(scaleRatio);
          }
        }
      }
      return true;
    }
    return false;
  }

  /*
  _onKeyEvent(ev, type) {
    if ( this._app && type === 'keydown' ) {
      //this._app.sendKey(ev.keyCode || ev.which);
    }
  };
  */

  setStatus(state, msg) {
    var value = state;
    if ( msg ) {
      value += ': ' + msg;
    }

    var statusBar = this._find('Statusbar');
    if ( statusBar ) {
      statusBar.set('value', value);
    }
  }

  openConnectionDialog(cb) {
    var self = this;

    if ( this.connectionDialog ) {
      this.connectionDialog._focus();
      return;
    }

    var w = new ApplicationVNCDialog(this._app, this._app.__metadata, function(btn, conn) {
      self.connectionDialog = null;
      cb(conn);
    });
    this.connectionDialog = this._addChild(w, true, true);
  }

}

class ApplicationVNCDialog extends Window {
  constructor(app, metadata, callback) {
    super('ApplicationVNCDialog', {
      icon: metadata.icon,
      title: metadata.name,
      width: 450,
      height: 400,
      allow_resize: false,
      allow_maximize: false
    }, app);

    this.callback = callback || function() {};
  }

  init(wmRef, app) {
    var root = super.init(...arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    this._render('VNCDialog', require('osjs-scheme-loader!scheme.html'));

    function getSettings() {
      return {
        host: self._find('InputHost').get('value'),
        port: self._find('InputPort').get('value'),
        token: self._find('InputToken').get('value'),
        password: self._find('InputPassword').get('value'),
        path: self._find('InputPath').get('value'),
        repeaterid: self._find('InputRepeaterID').get('value'),
        encrypt: self._find('ToggleEncrypt').get('value'),
        truecolor: self._find('ToggleTrueColor').get('value'),
        shared: self._find('ToggleSharedMode').get('value'),
        viewonly: self._find('ToggleViewOnly').get('value'),
        localcursor: self._find('ToggleLocalCursor').get('value'),
        scaling: self._find('InputScalingMode').get('value')
      };
    }

    this._find('InputHost').set('value', app.connectionSettings.host || 'localhost');
    this._find('InputPort').set('value', app.connectionSettings.port || 5900);
    this._find('InputToken').set('value', app.connectionSettings.token || '');
    this._find('InputPassword').set('value', app.connectionSettings.password || '');
    this._find('InputPath').set('value', app.connectionSettings.path || 'websockify');
    this._find('InputRepeaterID').set('value', app.connectionSettings.repeaterid || '');
    this._find('ToggleEncrypt').set('value', app.connectionSettings.encrypt);
    this._find('ToggleTrueColor').set('value', app.connectionSettings.truecolor);
    this._find('ToggleSharedMode').set('value', app.connectionSettings.shared);
    this._find('ToggleViewOnly').set('value', app.connectionSettings.viewonly);
    this._find('ToggleLocalCursor').set('value', app.connectionSettings.localcursor);
    this._find('InputScalingMode').set('value', app.connectionSettings.scaling || 'off');

    this._find('ButtonOK').on('click', function() {
      self._close('ok', getSettings());
    });

    this._find('ButtonCancel').on('click', function() {
      self._close();
    });

    return root;
  }

  _close(button, result) {
    this.callback(button, result);
    return super._close(...arguments);
  }

}

class ApplicationVNC extends Application {
  constructor(args, metadata) {
    super('ApplicationVNC', args, metadata);

    this.rfb = null;
    this.connectionState = null;
    this.connectionSettings = {
      host: 'localhost',
      port: 5901,
      token: '',
      path: 'websockify',
      repeaterid: '',
      encrypt: window.location.protocol === 'https:',
      truecolor: true,
      localcursor: true,
      shared: true,
      viewonly: false,
      password: '',
      scaling: 'off'
    };
  }

  destroy() {
    this.disconnect();
    return super.destroy(...arguments);
  }

  init(settings, metadata) {
    var self = this;
    super.init(...arguments);

    if ( settings && typeof settings.lastConnection === 'object' ) {
      Object.keys(settings.lastConnection).forEach(function(k) {
        self.connectionSettings[k] = settings.lastConnection[k];
      });
    }

    this._addWindow(new ApplicationVNCWindow(this, metadata));
  }

  onUpdateState(rfb, state, oldstate, msg) {
    this.connectionState = state;
    var win = this._getMainWindow();
    if ( !win ) {
      return;
    }

    win.setStatus(state, msg);
    win._focus(true);
  }

  onXvpInit(ver) {
  }

  onClipboard(rfb, text) {
  }

  onFBUComplete() {
    this.rfb.set_onFBUComplete(function() { });
  }

  onFBResize(rfb, width, height) {
    var win = this._getMainWindow();
    if ( win ) {
      win._resize(width + 40, height + 80, true); // FIXME
    }
  }

  onDesktopName(rfb, name) {
    var win = this._getMainWindow();
    if ( win ) {
      win._setTitle(name, true);
    }
  }

  connect(win, canvas) {
    var self = this;

    function initRFB() {
      self.rfb = new RFB({
        target: canvas,
        onUpdateState: function() {
          self.onUpdateState.apply(self, arguments);
        },
        onXvpInit: function() {
          self.onXvpInit.apply(self, arguments);
        },
        onClipboard: function() {
          self.onClipboard.apply(self, arguments);
        },
        onFBUComplete: function() {
          self.onFBUComplete.apply(self, arguments);
        },
        onFBResize: function() {
          self.onFBResize.apply(self, arguments);
        },
        onDesktopName: function() {
          self.onDesktopName.apply(self, arguments);
        }
      });
      return true;
    }

    win.openConnectionDialog(function(conn) {
      console.log('ApplicationVNC::connect()', canvas, conn);

      if ( conn ) {
        self.disconnect(win);

        self._setSetting('lastConnection', conn, true);

        if ( initRFB() ) {
          Object.keys(conn).forEach(function(k) {
            self.connectionSettings[k] = conn[k];
          });

          self.rfb.set_encrypt(conn.encrypt);
          //self.rfb.set_true_color(conn.truecolor);
          self.rfb.set_local_cursor(conn.localcursor);
          self.rfb.set_shared(conn.shared);
          self.rfb.set_view_only(conn.viewonly);
          self.rfb.set_repeaterID(conn.repeaterid);

          self.rfb.connect(conn.host, conn.port, conn.password, conn.path);
        }
      }
    });
  }

  disconnect(win) {
    if ( this.rfb ) {
      this.rfb.disconnect();
      this.rfb.set_onFBUComplete(this.FBUComplete);
    }
    this.rfb = null;
  }

  toggleFocus(focus) {
    if ( this.rfb ) {
      this.rfb.get_keyboard().set_focused(focus);
      this.rfb.get_mouse().set_focused(focus);
    }
  }

  sendKey(key) {
    if ( this.rfb ) {
      this.rfb.sendKey(key);
    }
  }

}

OSjs.Applications.ApplicationVNC = ApplicationVNC;
