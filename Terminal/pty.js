/*!
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
import io from 'socket.io-client';
import Terminal from 'term.js/src/term.js';

const Utils = OSjs.require('utils/misc');
const Dialog = OSjs.require('core/dialog');
const Authenticator = OSjs.require('core/authenticator');

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

var sessions = {};
var pid;
var port;
var mainSocket;

function destroySessions() {
  console.warn('PTY -> destroySessions()');

  Object.keys(sessions).forEach(function(k) {
    if ( k && sessions[k] ) {
      try {
        sessions[k].destroy();
      } catch ( e ) {}
      delete sessions[k];
    }
  });

  if ( mainSocket ) {
    if ( pid ) {
      mainSocket.emit('kill', pid);
    }

    mainSocket.disconnect();
    mainSocket = null;
  }
}

function createSpawnConnection(host, cb) {
  console.warn('PTY -> createSpawnConnection()', 'host', host);

  function done() {

    function _conn(un) {
      console.warn('PTY -> createSpawnConnection()', 'username', un);
      mainSocket.emit('spawn', un, function(_pid, _port) {
        cb(_pid, _port);
      });
    }

    const username = Authenticator.instance.getUser().username;
    if ( username === 'demo' ) {
      Dialog.create('Input', {
        message: 'Please input the username you want to connect with',
        value: username
      }, function(ev, btn, value) {
        if ( btn === 'ok' ) {
          _conn(value);
        }
      });
    } else {
      _conn(username);
    }
  }

  if ( mainSocket ) {
    done(pid, port);
    return;
  }

  mainSocket = io.connect(host, {
    'max reconnection attempts': 10,
    'force new connection': true
  });

  mainSocket.on('warning', function(msg) {
    console.warn('PTY -> mainSocket', 'on()', 'warning', msg);
  });

  mainSocket.on('connect', function() {
    console.warn('PTY -> mainSocket', 'on()', 'connect');
    done();
  });

  mainSocket.on('disconnect', function(ev) {
    console.warn('PTY -> mainSocket', 'on()', 'disconnect', ev);
    destroySessions(null);
  });
}

/////////////////////////////////////////////////////////////////////////////
// PTY TERMINAL
/////////////////////////////////////////////////////////////////////////////

export default class PTYTerminal {

  /**
   * This helper creates a Terminal widget and connection to PTY
   *
   * @api OSjs.Helpers.PTYTerminal
   *
   * @class
   */
  constructor(host) {
    this.destroyed = false;
    this.terminal = null;
    this.titleInterval = null;
    this.pingInterval = null;
    this.previousTitle = null;
    this.hostname = host;
    this.events = {'connected': [], 'destroyed': [], 'title': []};
    this.socket = null;
    this.sessionId = null;
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
  emit(key) {
    var args = Array.prototype.slice.call(arguments, 1, arguments.length);
    this.events[key].forEach(function(f) {
      f.apply(null, args);
    });
  }

  /**
   * Register an event
   *
   * @param   String      key     Event name
   * @param   Function    fn      Callback
   *
   * @method  PTYTerminal::on()
   * @return  void
   */
  on(key, fn) {
    this.events[key].push(fn);
  }

  /**
   * Initializes terminal
   *
   * @param   DOMElement  root    The root to apply widget
   * @param   Object      opts    Options object
   *
   * @method  PTYTerminal::init()
   * @return  void
   */
  init(root, opts) {
    console.warn('PTYTerminal::init()');

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
      if ( self.socket && self.id ) {
        self.socket.emit('process', self.id, function(err, name) {
          if ( name ) {
            self.emit('title', name);
          }
        });
      }
    }, 1000);

    term.on('data', function(data) {
      if ( self.socket && self.id ) {
        self.socket.emit('data', self.id, data);
      }
    });

    this.terminal = term;

    term.open(root);

    return true;
  }

  /**
   * Establish connection
   *
   * @method  PTYTerminal::connect()
   * @return  void
   */
  connect() {
    console.warn('PTYTerminal::connect()');

    var self = this;
    var recieved = 0;

    if ( this.terminal ) {
      this.terminal.startBlink();
      this.terminal.focus();
    }

    this.put('... connecting to ' + this.hostname + '\r\n');

    function createSocket(host) {
      var socket = io.connect(host, {
        'max reconnection attempts': 10,
        'force new connection': true
      });

      socket.on('disconnect', function(ev) {
        console.warn('PTYTerminal -> socket', 'on()', 'disconnect', ev);
        destroySessions();
        socket = null;
      });

      socket.on('connect', function() {
        console.warn('PTYTerminal -> socket', 'on()', 'connect');

        socket.emit('spawn', function(id) {
          console.warn('SPAWNED TERMINAL ON SERVER WITH', id);

          self.id = id;
          sessions[id] = self;

          self.emit('connected');
        });

        socket.on('kill', function(id) {
          console.warn('PTYTerminal -> socket', 'on()', 'kill');
          if ( recieved <= 2 ) {
            return;
          }
          return;

          var term = sessions[id];
          if ( term ) {
            term.destroy();
          }
        });

        socket.on('data', function(id, data) {
          recieved++;

          var term = sessions[id];
          if ( term ) {
            term.put(data);
          }
        });

      });

      return socket;
    }

    var hostname = this.hostname;
    createSpawnConnection(hostname, function(_pid, _port) {
      pid  = _pid  || pid;
      port = _port || port;

      var host = hostname.split(':')[0] + ':' + port;
      self.socket = createSocket(host);
    });
  }

  /**
   * Put data into Terminal
   *
   * @param   String        d       Input data
   *
   * @method  PTYTerminal::put()
   * @return  void
   */
  put(d) {
    if ( this.terminal ) {
      this.terminal.write(d);
    }
  }

  /**
   * Resize Terminal
   *
   * @param   int           x       Cols
   * @param   int           y       Rows
   *
   * @method  PTYTerminal::resize()
   * @return  void
   */
  resize(x, y) {
    if ( this.socket && this.id ) {
      this.socket.emit('resize', this.id, x, y);
    }
    if ( this.terminal ) {
      this.terminal.resize(x, y);
    }
  }

  /**
   * Perform a input event
   *
   * @param   String        type    Event type
   * @param   DOMEvent      ev      Event reference
   *
   * @method  PTYTerminal::event()
   * @return  void
   */
  event(type, ev) {
    if ( this.terminal ) {
      if ( type === 'keydown' ) {
        this.terminal.keyDown(ev);
      } else if ( type === 'keypress' ) {
        this.terminal.keyPress(ev);
      }
    }
  }

  /**
   * Destroys the Terminal sessions
   *
   * @method  PTYTerminal::destroy()
   * @return  void
   */
  destroy() {
    console.warn('PTYTerminal::destroy()');

    if ( this.destroyed ) {
      return;
    }

    if ( this.titleInterval ) {
      this.titleInterval = clearInterval(this.titleInterval);
    }
    if ( this.pingInterval ) {
      this.pingInterval = clearInterval(this.pingInterval);
    }
    if ( this.socket && this.id ) {
      this.socket.emit('destroy', this.id);
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
      if ( this.socket ) {
        this.socket.disconnect();
      }
      this.socket = null;
    }
  }

  /**
   * Focus the Terminal
   *
   * @method  PTYTerminal::focus()
   * @return  void
   */
  focus() {
    if ( this.terminal ) {
      this.terminal.focus();
    }
  }

  /**
   * Blur the Terminal
   *
   * @method  PTYTerminal::blur()
   * @return  void
   */
  blur() {
    if ( this.terminal ) {
      this.terminal.blur();
    }
  }

}
