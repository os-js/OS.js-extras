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
(function(Application, Window, Utils, API, VFS, GUI) {
  'use strict';

  // https://code.google.com/p/aap-etsiit-ugr/source/browse/trunk/2011/chat_xmpp/scripts/presencia.strophe.js?r=3008
  // http://strophe.im/strophejs/doc/

  var iconMap = {
    'busy': 'status/user-busy.png',
    'away': 'status/user-busy.png',
    'chat': 'status/user-available.png',
    'online': 'status/user-available.png',
    'offline': 'status/user-offline.png',
    'invisible': 'status/user-invisible.png'
  };

  function getDisplayName(contact) {
    if ( contact.vcard && contact.vcard.name ) {
      return contact.vcard.name + ' (' + contact.username + ')';
    }
    return contact.username;
  }

  function getVcardImage(vcard) {
    vcard = vcard || {};
    if ( vcard.photo && vcard.photo.type && vcard.photo.data ) {
      return Utils.format('data:{0};base64,{1}', vcard.photo.type, vcard.photo.data);
    }

    var url = API.getApplicationResource('ApplicationChat', 'user.png');
    return url;
  };

  /////////////////////////////////////////////////////////////////////////////
  // CONNECTION MANAGER
  /////////////////////////////////////////////////////////////////////////////

  function StropheConnection(app) {
    this.app = app;
    this.bindings = {};
    this.contacts = {};
    this.connected = false;
    this.user = {
      id: -1,
      vcard: null
    };

    this.connection = new Strophe.Connection('/http-bind-jabber/');

    this.connection.rawInput = function(data) {
    };

    this.connection.rawOutput = function(data) {
    };

    var _vctimeout;
    var self = this;
    this.on('contacts', function(contacts, vcard) {
      if ( vcard ) return;

      Object.keys(self.contacts).forEach(function(i) {
        var c = self.contacts[i];

        self.vcard(c.username, function() {
          clearTimeout(_vctimeout);
          _vctimeout = setTimeout(function() {
            self._trigger('contacts', self.contacts, true);
          }, 2000);
        });
      });
    });
  }
  StropheConnection.prototype.destroy = function() {
    this.disconnect();
    this.connection = null;
    this.app = null;
  };

  StropheConnection.prototype.on = function(k, f) {
    if ( typeof this.bindings[k] === 'undefined' ) {
      this.bindings[k] = [];
    }
    this.bindings[k].push(f);
  };

  StropheConnection.prototype._trigger = function(k) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 1);

    console.log('StropheConnection::_trigger()', k, args);
    (this.bindings[k] || []).forEach(function(f) {
      f.apply(self, args);
    });
  };

  StropheConnection.prototype.setStatus = function(s, text) {
    var pres = $pres({
      from: this.user.id
    });
    pres.c('show', s);
    if ( text ) {
      pres.c('status', text);
    }

    this._trigger('status', s);

    console.log('StropheConnection::setStatus()', s, text, pres);
    this.connection.send(pres.tree());
  };

  StropheConnection.prototype.disconnect = function() {
    console.log('StropheConnection::disconnect()');

    if ( this.connected ) {
      this.connection.disconnect();
    }

    this.connected = false;
    this.user.id = -1;
    this.user.vcard = null;

    this._trigger('disconnected');
  };

  StropheConnection.prototype.connect = function() {
    console.log('StropheConnection::connect()');

    var self = this;
    var states = {};

    states[Strophe.Status.ATTACHED] = {
      text: 'Attached',
      fn: function() {
        self._trigger('attached');
      }
    };
    states[Strophe.Status.AUTHENTICATING] = {
      text: 'Authenticating',
      fn: function() {
        self._trigger('authenticating');
      }
    };
    states[Strophe.Status.ERROR] = {
      text: 'Error',
      fn: function() {
        self._trigger('error');
      }
    };
    states[Strophe.Status.REDIRECT] = {
      text: 'Redirected',
      fn: function() {
        self._trigger('redirect');
      }
    };
    states[Strophe.Status.AUTHFAIL] = {
      text: 'Authentication Failure',
      fn: function() {
        self._onAuthFail();
      }
    };
    states[Strophe.Status.CONNECTED] = {
      text: 'Connected',
      fn: function() {
        self._onConnected();
      }
    };
    states[Strophe.Status.CONNECTING] = {
      text: 'Connecting',
      fn: function() {
        self._onConnecting();
      }
    };
    states[Strophe.Status.CONNFAIL] = {
      text: 'Connection Failure',
      fn: function() {
        self._onConnectionFail();
      }
    };
    states[Strophe.Status.DISCONNECTED] = {
      text: 'Disconnected',
      fn: function() {
        self._onDisconnected();
      }
    };
    states[Strophe.Status.DISCONNECTING] = {
      text: 'Disconnecting',
      fn: function() {
        self._onDisconnecting();
      }
    };

    this.disconnect();

    function _connect(stat) {
      if ( states[stat] && states[stat].fn ) {
        states[stat].fn();
      }
    }

    var settings = this.app._getSetting('account') || {};
    if ( !settings.username || !settings.password ) {
      this.disconnect();
      API.createDialog('Error', {
        title: 'Chat Error',
        error: 'Cannot connect without username or password'
      }, function() {}, this.app);
      return;
    }

    try {
      this.connection.restore(null, _connect);
    } catch ( e ) {
      console.warn('StropheConnection::connect()', 'Could not restore', e, e.stack);
      console.warn('reconnecting instead');
      this.connection.connect(settings.username, settings.password, _connect);
    }
  };

  StropheConnection.prototype.send = function(msg) {
    console.log('StropheConnection::send()', msg);

    var reply = $msg({to: msg.jid, from: this.user.id, type: 'chat'})
                  .cnode(Strophe.xmlElement('body', msg.message)).up()
                  .c('active', {xmlns: "http://jabber.org/protocol/chatstates"});

    this.connection.send(reply.tree());
  };

  StropheConnection.prototype.vcard = function(jid, callback) {
    callback = callback || function() {};

    console.log('StropheConnection::vcard()', jid);
    var username = jid.split('/')[0];
    if ( this.contacts[username] && this.contacts[username].vcard ) {
      callback(this.contacts[username].vcard);
      return;
    }

    var self = this;
    var iq = $iq({type: 'get', to: jid, id: this.connection.getUniqueId('vCard')})
                .c('vCard', {xmlns: 'vcard-temp'}).tree();

    this.connection.sendIQ(iq, function (response) {
      console.log('StropheConnection::vcard()', '=>', response);

      var item = null;
      try {
        var elem = response.getElementsByTagName("vCard");

        if ( elem.length ) {
          var fn    = Strophe.getText(elem[0].getElementsByTagName('FN')[0]);
          var url   = Strophe.getText(elem[0].getElementsByTagName('URL')[0]);
          var photo = null;

          try {
            var pel = elem[0].getElementsByTagName('PHOTO')[0];
            photo = {
              type: Strophe.getText(pel.getElementsByTagName('TYPE')[0]),
              data: Strophe.getText(pel.getElementsByTagName('BINVAL')[0])
            };
          } catch ( e ) {
          }

          item = {
            name:   fn,
            url:    url,
            photo:  photo
          };

          if ( self.contacts[username] ) {
            self.contacts[username].vcard = item;
          }
        }
      } catch ( e ) {
        console.warn(e, e.stack);
      }

      callback(item);
    });
  };

  StropheConnection.prototype._onConnectionFail = function() {
    this._trigger('connfail');
  };

  StropheConnection.prototype._onAuthFail = function() {
    this._trigger('authfail');
  };

  StropheConnection.prototype._onConnecting = function() {
    this._trigger('connecting');
  };

  StropheConnection.prototype._onConnected = function() {
    var self = this;

    this.connected = true;
    this.user.id = this.connection.jid;

    this.connection.addHandler(function(pres) {
      return self._onPresence(pres);
    }, null, 'presence', null, null,  null);

    this.connection.addHandler(function(msg) {
      return self._onMessage(msg);
    }, null, 'message', null, null,  null);

    this.connection.addHandler(function(x) {
      return true;
    }, "jabber:iq:roster", "iq", "set");

    this.connection.send($pres().tree());

    this.vcard(self.user.id, function(item) {
      self.user.vcard = item || null;

      self._trigger('connected');
    });

    this._trigger('status', 'chat');
  };

  StropheConnection.prototype._onDisconnecting = function() {
    this._trigger('disconnecting');
  };

  StropheConnection.prototype._onDisconnected = function() {
    this.connected = false;
    this.disconnect();
  };

  StropheConnection.prototype._onPresence = (function() {

    function parsePresence(pres, self) {
      var from = pres.getAttribute('from') || '';
      var error = pres.querySelector('error');
      if ( error ) {
        console.warn('StropheConnection::_onPrecense()', 'error', Strophe.getText(pres), pres);
        return null;
      }

      var contact = {
        id:           from,
        vcard:        null,
        group:        null,
        photo:        null,
        username:     from.split('/')[0], // Contact
        account:      pres.getAttribute('to'), // Myself
        type:         pres.getAttribute('type'),
        state:        'offline',
        subscription: 'unavailable'
      };

      if ( contact.account ) {
        var elems, test;

        var showEl = pres.querySelector('show');
        var text = showEl ? Strophe.getText(showEl) : null;

        elems = pres.getElementsByTagName('show');
        test  = elems.length ? Strophe.getText(elems[0]) : '';
        contact.state = test ? test : (contact.subscription === 'unavailable' ? 'offline' : 'chat');

        elems = pres.getElementsByTagName('photo');
        contact.photo = Strophe.getText(elems[0]) || null;

        return contact;
      }

      return null;
    }

    var _timeout;

    return function(pres) {
      var self = this;

      this._trigger('presence', pres);

      // This makes sure we collect all contacts before rendering etc.
      clearTimeout(_timeout);

      try {
        var c = parsePresence(pres, self);
        if ( c ) {
          if ( this.contacts[c.username] ) {
            Object.keys(c).forEach(function(k) {
              if ( !self.contacts[c.username][k] ) {
                self.contacts[c.username][k] = c[k];
              }
            });
          } else {
            this.contacts[c.username] = c;
          }
        }
      } catch ( e ) {
        console.warn(e, e.stack);
      }

      _timeout = setTimeout(function() {
        self._trigger('contacts', self.contacts);
      }, 2000);

      return true;
    };
  })();

  StropheConnection.prototype._onMessage = function(msg) {
    var self = this;

    try {
      var elems = msg.getElementsByTagName('body');
      var to    = msg.getAttribute('to') || '';
      var from  = msg.getAttribute('from') || '';
      var type  = msg.getAttribute('type') || '';
      var jid   = from.split('/')[0];

      console.log('StropheConnection::_onMessage()', from, jid, msg);

      if ( elems.length ) {
        var message = Strophe.getText(elems[0]);
        this._trigger('message', {
          jid: jid,
          message: message
        });
      } else {
        msg.children.forEach(function(child) {
          var tagName = child.tagName.toLowerCase();
          if ( tagName === 'cha:composing' ) {
            self._trigger('compose', {
              jid: jid,
              state: true
            });
          } else if ( tagName === 'cha:paused' ) {
            self._trigger('compose', {
              jid: jid,
              state: false
            });
          }
        });
      }
    } catch ( e ) {
      console.warn(e, e.stack);
    }

    return true;
  };


  /////////////////////////////////////////////////////////////////////////////
  // SETTINGS WINDOW
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationSettingsWindow(app, metadata, scheme) {
    Window.apply(this, ['ApplicationChatSettingsWindow', {
      icon: metadata.icon,
      title: metadata.name,
      allow_resize: false,
      allow_maximize: false,
      width: 500,
      height: 300
    }, app, scheme]);
  }

  ApplicationSettingsWindow.prototype = Object.create(Window.prototype);
  ApplicationSettingsWindow.constructor = Window.prototype;

  ApplicationSettingsWindow.prototype.init = function(wmRef, app, scheme) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    scheme.render(this, 'SettingsWindow', root);

    var acc = app._getSetting('account') || {};
    var username = scheme.find(this, 'Username').set('value', acc.username || '');
    var password = scheme.find(this, 'Password').set('value', acc.password || '');

    scheme.find(this, 'ButtonSave').on('click', function() {
      app._setSetting('account', {
        username: username.get('value'),
        password: password.get('value')
      }, true);

      app.connection.connect();

      self._close();
    });

    scheme.find(this, 'ButtonClose').on('click', function() {
      self._close();
    });

    return root;
  };

  ApplicationSettingsWindow.prototype.destroy = function() {
    Window.prototype.destroy.apply(this, arguments);
  };

  /////////////////////////////////////////////////////////////////////////////
  // CHAT WINDOW
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationConversationWindow(id, app, metadata, scheme) {
    Window.apply(this, ['ApplicationConversationWindow_' + String(id), {
      tag: 'ApplicationConversationWindow',
      icon: metadata.icon,
      title: metadata.name,
      width: 400,
      height: 400
    }, app, scheme]);

    this._id = id;
    this._timeout =  null;
  }

  ApplicationConversationWindow.prototype = Object.create(Window.prototype);
  ApplicationConversationWindow.constructor = Window.prototype;

  ApplicationConversationWindow.prototype.init = function(wmRef, app, scheme) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    scheme.render(this, 'ConversationWindow', root);

    scheme.find(this, 'Input').on('enter', function(ev) {
      var msg = {
        jid: self._id,
        message: ev.detail
      };

      app.connection.send(msg);
      self.message(msg, null, true);
    });

    return root;
  };

  ApplicationConversationWindow.prototype.message = function(msg, jid, myself) {
    var username = (jid || '').split('/')[0];
    var contact = jid ? this._app.connection.contacts[username] : null;
    var now = new OSjs.Helpers.Date();
    var text = msg.message;

    var root = this._scheme.find(this, 'Conversation');
    var container = document.createElement('li');
    container.className = myself ? 'self' : 'remote';

    var image = document.createElement('img');
    var vcard = myself ? this._app.connection.vcard : contact.vcard;
    image.width = 32;
    image.height = 32;
    image.src = getVcardImage(vcard);

    var name = vcard.name || username || jid;
    var stamp = (myself ? 'me' : name) + ' | ' + now.format('isoTime');

    var p = document.createElement('p');
    p.appendChild(document.createTextNode(text));

    var span = document.createElement('span');
    span.appendChild(document.createTextNode(stamp));

    container.appendChild(image);
    container.appendChild(p);
    container.appendChild(span);
    root.append(container);

    var rel = root.$element.parentNode;
    rel.scrollTop = rel.scrollHeight;
    setTimeout(function() {
      rel.scrollTop = rel.scrollHeight;
    }, 100);

    if ( myself ) {
      var input = this._scheme.find(this, 'Input');
      setTimeout(function() {
        input.set('value', '');
      }, 10);
    }
  };

  ApplicationConversationWindow.prototype.compose = function(cmp, jid) {
    var statusbar = this._scheme.find(this, 'Statusbar');

    this._timeout = clearTimeout(this._timeout);
    this._timeout = setTimeout(function() {
      statusbar.set('value', '');
    }, 5 * 1000);

    if ( cmp.state ) {
      statusbar.set('value', cmp.jid + ' is typing...');
    } else {
      statusbar.set('value', cmp.jid + ' stopped typing...');
    }
  };

  ApplicationConversationWindow.prototype.destroy = function() {
    this._timeout = clearTimeout(this._timeout);

    Window.prototype.destroy.apply(this, arguments);
  };

  /////////////////////////////////////////////////////////////////////////////
  // MAIN WINDOW
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationChatWindow(app, metadata, scheme) {
    Window.apply(this, ['ApplicationChatWindow', {
      icon: metadata.icon,
      title: metadata.name + ' v0.1',
      width: 300,
      height: 500
    }, app, scheme]);
  }

  ApplicationChatWindow.prototype = Object.create(Window.prototype);
  ApplicationChatWindow.constructor = Window.prototype;

  ApplicationChatWindow.prototype.init = function(wmRef, app, scheme) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    scheme.render(this, 'ChatWindow', root);

    var statusMenu = scheme.find(this, 'SubmenuStatus');

    var menuMap = {
      MenuClose: function() {
        self._close(true);
      },

      AccountSettings: function() {
        app.openSettingsWindow();
      },
      AccountConnect: function() {
        app.connection.connect();
      },
      AccountDisconnect: function() {
        app.connection.disconnect();
      },

      StatusOnline: function() {
        app.connection.setStatus('chat');
        //app.connection.setStatus('online');
        //statusMenu.set('checked', 'StatusOnline', true);
      },
      StatusAway: function() {
        app.connection.setStatus('away');
        //statusMenu.set('checked', 'StatusAway', true);
      },
      StatusBusy: function() {
        app.connection.setStatus('busy');
        //statusMenu.set('checked', 'StatusBusy', true);
      },
      StatusExtendedAway: function() {
        self._toggleDisabled(true);
        API.createDialog('Input', {message: 'Away message'}, function(ev, button, result) {
          self._toggleDisabled(false);
          if ( button === 'ok' && result ) {
            app.connection.setStatus('xa', result);
          }
        });
        //statusMenu.set('checked', 'StatusExtendedAway', true);
      }
    };

    function menuEvent(ev) {
      if ( menuMap[ev.detail.id] ) {
        menuMap[ev.detail.id]();
      }
    }

    scheme.find(this, 'SubmenuFile').on('select', menuEvent);
    scheme.find(this, 'SubmenuAccount').on('select', menuEvent);
    scheme.find(this, 'SubmenuStatus').on('select', menuEvent);

    var statusbar = scheme.find(this, 'Statusbar');
    var view = scheme.find(this, 'Contacts');

    view.on('activate', function(ev) {
      if ( ev.detail.entries.length ) {
        app.openChatWindow(ev.detail.entries[0].data.username);
      }
    });

    function renderContacts(contacts) {
      var entries = [];

      Object.keys(contacts).forEach(function(c) {
        var iter = contacts[c];
        if ( c === app.connection.user.id.split('/')[0] ) {
          return;
        }

        entries.push({
          icon: API.getIcon(iconMap[iter.state]),
          label: getDisplayName(iter),
          value: iter
        });
      });

      view.clear();
      view.add(entries);
    }

    function setConnected(online) {
      scheme.find(self, 'MenuStatus').set('disabled', !online);
      scheme.find(self, 'AccountConnect').set('disabled', online);
      scheme.find(self, 'AccountDisconnect').set('disabled', !online);
    }

    app.connection.on('error', function() {
      statusbar.set('value', 'An error occured...');
      setConnected(false);
    });

    app.connection.on('attached', function() {
      statusbar.set('value', 'Attached...');
      setConnected(false);
    });

    app.connection.on('authenticating', function() {
      statusbar.set('value', 'Authenticating...');
      setConnected(false);
    });

    app.connection.on('redirected', function() {
      statusbar.set('value', 'Connection redirected...');
      setConnected(false);
    });

    app.connection.on('connected', function() {
      statusbar.set('value', 'Connected');
      setConnected(true);
    });

    app.connection.on('connecting', function() {
      statusbar.set('value', 'Connecting...');
      setConnected(false);
    });

    app.connection.on('disconnecting', function() {
      statusbar.set('value', 'Disconnecting...');
      setConnected(false);
    });

    app.connection.on('disconnected', function() {
      view.clear();
      statusbar.set('value', 'Disconnected');
      setConnected(false);
    });

    app.connection.on('authfail', function() {
      statusbar.set('value', 'Authentication failure...');
      setConnected(false);
    });

    app.connection.on('connfail', function() {
      statusbar.set('value', 'Connection failure...');
      setConnected(false);
    });

    app.connection.on('status', function(s) {
      var map = {
        'online' : 'Online',
        'chat'   : 'Online',
        'away'   : 'Away',
        'busy'   : 'Busy',
        'xa'     : 'ExtendedAway'
      };

      statusMenu.set('checked', 'Status' + map[s], true);

      if ( app.notification ) {
        app.notification.$image.src = API.getIcon(iconMap[s]);
      }
    });

    app.connection.on('contacts', function(contacts) {
      renderContacts(contacts || {});
    });

    statusMenu.set('checked', 'StatusOnline', true);
    setConnected(false);

    return root;
  };

  ApplicationChatWindow.prototype._close = function(doit) {
    if ( !doit ) {
      this._minimize();
      return false;
    }
    Window.prototype._close.apply(this, arguments);
  };

  ApplicationChatWindow.prototype.destroy = function() {
    Window.prototype.destroy.apply(this, arguments);
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationChat(args, metadata) {
    Application.apply(this, ['ApplicationChat', args, metadata]);

    this.notification = null;
    this.connection = new StropheConnection(this);
  }

  ApplicationChat.prototype = Object.create(Application.prototype);
  ApplicationChat.constructor = Application;

  ApplicationChat.prototype.destroy = function() {
    var wm = OSjs.Core.getWindowManager();
    if ( wm ) {
      wm.removeNotificationIcon('ApplicationChatNotificationIcon');
    }

    this.connection.destroy();

    if ( this.notification ) {
      this.notification.destroy();
    }

    this.notification = null;
    this.connection = null;

    return Application.prototype.destroy.apply(this, arguments);
  };

  ApplicationChat.prototype.init = function(settings, metadata, onInited) {
    Application.prototype.init.apply(this, arguments);

    var self = this;
    var url = API.getApplicationResource(this, './scheme.html');
    var scheme = GUI.createScheme(url);
    var mainWindow = null;

    this.connection.on('message', function(msg) {
      if ( msg.jid ) {
        var username = msg.jid.split('/')[0];
        var message = (msg.message || '').substr(0, 100);
        self.openChatWindow(username, function(w) {
          if ( !w._state.focused ) {
            API.createNotification({
              icon: API.getIcon('status/user-available.png'),
              title: username,
              message: message,
              onClick: function() {
                w._restore();
              }
            });
          }

          try {
            w.message(msg, msg.jid);
          } catch ( e ) {
            console.warn(e, e.stack);
          }
        });
      }
    });

    this.connection.on('compose', function(cmp) {
      if ( cmp.jid ) {
        self.openChatWindow(cmp.jid.split('/')[0], function(w) {
          if ( w ) {
            w.compose(cmp, cmp.jid);
          }
        }, true);
      }
    });

    var wm = OSjs.Core.getWindowManager();
    if ( wm ) {
      this.notification = wm.createNotificationIcon('ApplicationChatNotificationIcon', {
        className: 'ApplicationChatNotificationIcon',
        tooltip: '',
        onCreated: function() {
          var img = document.createElement('img');
          img.src = API.getIcon('status/user-invisible.png');
          this.$inner.appendChild(img);
          this.$image = img;
        }, onInited: function() {
        }, onDestroy: function() {
          self.notification = null;
        }, onClick: function(ev) {
          if ( mainWindow ) {
            mainWindow._restore();
          }
        }, onContextMenu: function(ev) {
          if ( mainWindow ) {
            mainWindow._restore();
          }
        }
      });
    }

    var acc = this._getSetting('account') || {};
    scheme.load(function(error, result) {
      self._setScheme(scheme);

      mainWindow = self._addWindow(new ApplicationChatWindow(self, metadata, scheme));

      if ( acc.username && acc.password ) {
        self.connection.connect();
      } else {
        self.openSettingsWindow();
      }

      onInited();
    });

  };

  ApplicationChat.prototype.openChatWindow = function(id, cb, check) {
    cb = cb || function() {};

    var self = this;
    var win = this._getWindowByName('ApplicationConversationWindow_' + String(id));
    if ( !win && !check ) {
      win = this._addWindow(new ApplicationConversationWindow(id, this, this.__metadata, this.__scheme));
    }

    this.connection.vcard(id, function(vc) {
      if ( vc && vc.name ) {
        win._setTitle(vc.name, true);
      }
      cb(win);
    });
  };

  ApplicationChat.prototype.openSettingsWindow = function() {
    var win = this._getWindowByName('ApplicationChatSettingsWindow');
    if ( win ) {
      win._restore();
    } else {
      win = this._addWindow(new ApplicationSettingsWindow(this, this.__metadata, this.__scheme));
    }

  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationChat = OSjs.Applications.ApplicationChat || {};
  OSjs.Applications.ApplicationChat.Class = ApplicationChat;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.Utils, OSjs.API, OSjs.VFS, OSjs.GUI);
