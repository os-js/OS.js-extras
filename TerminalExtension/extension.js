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

(function(Utils, VFS, API) {
  'use strict';

  window.OSjs       = window.OSjs       || {};
  OSjs.Helpers      = OSjs.Helpers      || {};

  /////////////////////////////////////////////////////////////////////////////
  // HELPERS
  /////////////////////////////////////////////////////////////////////////////

  var sessions = {};
  var socket;

  function destroySessions() {
    Object.keys(sessions).forEach(function(k) {
      if ( k && sessions[k] ) {
        try {
          sessions[k].destroy();
        } catch ( e ) {}
        delete sessions[k];
      }
    });
  }

  function createSession(host, term) {
    createConnection(host, function() {
      socket.emit('spawn', function(id) {
        console.warn('SPAWNED TERMINAL ON SERVER WITH', id);

        term.id = id;
        sessions[id] = term;

        term.emit('connected');
      });
    });
  }

  function createConnection(host, cb) {
    if ( socket ) {
      console.info('SOCKET OPEN ALREADY');
      cb();
      return;
    }

    socket = io.connect(host, {
      'max reconnection attempts': 10,
      'force new connection': true
    });

    socket.on('disconnect', function() {
      destroySessions();
      socket = null;
    });

    socket.on('connect', function() {

      /*
      socket.on('resize', function(x, y) {
        if ( term ) {
          term.resize(x, y);
        }
      });
      */

      socket.on('kill', function(id) {
        var term = sessions[id];
        if ( term ) {
          term.destroy();
        }
      });

      socket.on('data', function(id, data) {
        var term = sessions[id];
        if ( term ) {
          term.put(data);
        }
      });

      cb();
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  // PTY TERMINAL
  /////////////////////////////////////////////////////////////////////////////

  /**
   * This helper creates a Terminal widget and connection to PTY
   *
   * @api OSjs.Helpers.PTYTerminal
   *
   * @class
   */
  function PTYTerminal(host) {
    this.destroyed = false;
    this.terminal = null;
    this.titleInterval = null;
    this.pingInterval = null;
    this.previousTitle = null;
    this.hostname = host;
    this.events = {'connected': [], 'destroyed': [], 'title': []};
    this.id = null;
  }

  /**
   * Emit an event
   *
   * @param   String      key     Event name
   *
   * @method  PTYTerminal::emit()
   * @return  void
   */
  PTYTerminal.prototype.emit = function(key) {
    var args = Array.prototype.slice.call(arguments, 1, arguments.length);
    this.events[key].forEach(function(f) {
      f.apply(null, args);
    });
  };

  /**
   * Register an event
   *
   * @param   String      key     Event name
   * @param   Function    fn      Callback
   *
   * @method  PTYTerminal::on()
   * @return  void
   */
  PTYTerminal.prototype.on = function(key, fn) {
    this.events[key].push(fn);
  };

  /**
   * Initializes terminal
   *
   * @param   DOMElement  root    The root to apply widget
   * @param   Object      opts    Options object
   *
   * @method  PTYTerminal::init()
   * @return  void
   */
  PTYTerminal.prototype.init = function(root, opts) {
    opts = Utils.argumentDefaults(opts, {
      rows: 24,
      cols: 80
    });

    var self = this;
    var term = new Terminal({
      cols: opts.cols,
      rows: opts.rows,
      useEvents: false,
      screenKeys: true
    });

    this.titleInterval = setInterval(function() {
      if ( socket && self.id ) {
        socket.emit('process', self.id, function(err, name) {
          if ( name ) {
            self.emit('title', name);
          }
        });
      }
    }, 1000);

    this.pingInterval = setInterval(function() {
      if ( socket && self.id ) {
        socket.emit('ping', self.id);
      }
    }, 30000);

    term.on('data', function(data) {
      if ( socket && self.id ) {
        socket.emit('data', self.id, data);
      }
    });

    this.terminal = term;

    term.open(root);
  };

  /**
   * Establish connection
   *
   * @method  PTYTerminal::connect()
   * @return  void
   */
  PTYTerminal.prototype.connect = function() {
    if ( this.terminal ) {
      this.terminal.startBlink();
      this.terminal.focus();
    }

    this.put('... connecting to ' + this.hostname + '\r\n');

    createSession(this.hostname, this);
  };

  /**
   * Put data into Terminal
   *
   * @param   String        d       Input data
   *
   * @method  PTYTerminal::put()
   * @return  void
   */
  PTYTerminal.prototype.put = function(d) {
    if ( this.terminal ) {
      this.terminal.write(d);
    }
  };

  /**
   * Resize Terminal
   *
   * @param   int           x       Cols
   * @param   int           y       Rows
   *
   * @method  PTYTerminal::resize()
   * @return  void
   */
  PTYTerminal.prototype.resize = function(x, y) {
    if ( socket && this.id ) {
      socket.emit('resize', this.id, x, y);
    }
    if ( this.terminal ) {
      this.terminal.resize(x, y);
    }
  };

  /**
   * Perform a input event
   *
   * @param   String        type    Event type
   * @param   DOMEvent      ev      Event reference
   *
   * @method  PTYTerminal::event()
   * @return  void
   */
  PTYTerminal.prototype.event = function(type, ev) {
    if ( this.terminal ) {
      if ( type === 'keydown' ) {
        this.terminal.keyDown(ev);
      } else if ( type === 'keypress' ) {
        this.terminal.keyPress(ev);
      }
    }
  };

  /**
   * Destroys the Terminal sessions
   *
   * @method  PTYTerminal::destroy()
   * @return  void
   */
  PTYTerminal.prototype.destroy = function() {
    if ( this.destroyed ) {
      return;
    }

    if ( this.titleInterval ) {
      this.titleInterval = clearInterval(this.titleInterval);
    }
    if ( this.pingInterval ) {
      this.pingInterval = clearInterval(this.pingInterval);
    }
    if ( socket && this.id ) {
      socket.emit('destroy', this.id);
    }
    if ( this.terminal ) {
      this.terminal.destroy();
    }
    if ( this.id && sessions[this.id] ) {
      delete sessions[this.id];
    }

    this.emit('destroyed');

    this.destroyed = true;
    this.terminal = null;
    this.events = [];
    this.id = null;

    if ( !Object.keys(sessions).length ) {
      console.warn('ALL SESSIONS DESTROYED...CLOSING CONNECTION');
      if ( socket ) {
        socket.disconnect();
      }
      socket = null;
    }
  };

  /**
   * Focus the Terminal
   *
   * @method  PTYTerminal::focus()
   * @return  void
   */
  PTYTerminal.prototype.focus = function() {
    if ( this.terminal ) {
      this.terminal.focus();
    }
  };

  /**
   * Blur the Terminal
   *
   * @method  PTYTerminal::blur()
   * @return  void
   */
  PTYTerminal.prototype.blur = function() {
    if ( this.terminal ) {
      this.terminal.blur();
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Helpers.PTYTerminal = PTYTerminal;

})(OSjs.Utils, OSjs.VFS, OSjs.API);

