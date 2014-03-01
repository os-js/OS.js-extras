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

  var _getStatusIcon = function(s) {
    var icon = 'about:blank';

    switch ( s ) {
      case 'chat' :
        icon = OSjs.API.getThemeResource('status/user-available.png', 'icon', '16x16');
        break;

      case 'xa' :
      case 'away' :
        icon = OSjs.API.getThemeResource('status/user-away.png', 'icon', '16x16');
        break;

      case 'dnd' :
        icon = OSjs.API.getThemeResource('status/user-busy.png', 'icon', '16x16');
        break;

      default :
        icon = OSjs.API.getThemeResource('status/user-offline.png', 'icon', '16x16');
        break;
    }
    return icon;
  };

  var _getVcardImage = function(vcard) {
    vcard = vcard || {};
    if ( vcard.photo && vcard.photo.type && vcard.photo.data ) {
      return OSjs.Utils.format("data:{0};base64,{1}", 
                               vcard.photo.type,
                               vcard.photo.data);
    }
    return null;
  };

  var StatusDescriptions = {
    'offline' : 'Offline',
    'away'    : 'Away',
    'chat'    : 'Online',
    'dnd'     : 'Do not disturb',
    'xa'      : 'Away'
  };

  /////////////////////////////////////////////////////////////////////////////
  // SETTINGS WINDOW
  /////////////////////////////////////////////////////////////////////////////

  var SettingsWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationChatSettingsWindow', {width: 400, height: 300}, app]);

    // Set window properties and other stuff here
    this._title = metadata.name + ' - Settings';
    this._icon  = metadata.icon;
    this._properties.allow_resize = false;
    this._properties.allow_maximize = false;
  };

  SettingsWindow.prototype = Object.create(Window.prototype);

  SettingsWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    var settings = app._getSetting('account') || {};

    // Create window contents (GUI) here
    var _createContainer = function(label) {
      var el = document.createElement('div');
      el.className = 'Setting';
      var lbl = document.createElement('div');
      lbl.className = 'Label';
      lbl.appendChild(document.createTextNode(label));
      el.appendChild(lbl);
      return el;
    };

    var buttonContainer = document.createElement('div');
    buttonContainer.className = 'Buttons';

    var container = _createContainer('Your Name');
    var name = this._addGUIElement(new OSjs.GUI.Text('SettingsName', {value: settings.name}), container);
    root.appendChild(container);

    container = _createContainer('Account Type');
    var accountType = this._addGUIElement(new OSjs.GUI.Select('SettingsAccountType', {}), container);
    accountType.addItems({
      'default':  'XMPP via BOSH (Jabber, Google Talk)'
    });
    root.appendChild(container);

    container = _createContainer('Account Username');
    var username = this._addGUIElement(new OSjs.GUI.Text('SettingsUsername', {placeholder: 'username@gmail.com', value: settings.username}), container);
    root.appendChild(container);

    container = _createContainer('Account Password');
    var password = this._addGUIElement(new OSjs.GUI.Text('SettingsPassword', {value: settings.password, type: 'password'}), container);
    root.appendChild(container);


    this._addGUIElement(new OSjs.GUI.Button('Save', {label: OSjs._('Save'), onClick: function(el, ev) {
      var opts = {
        name : name.getValue(),
        type : accountType.getValue(),
        username: username.getValue(),
        password: password.getValue()
      };

      if ( opts.username && opts.password ) {
        opts.configured = true;
      } else {
        opts.configured = false;
      }

      app.setAccountSettings(opts);

      self._close();
    }}), buttonContainer);

    this._addGUIElement(new OSjs.GUI.Button('Close', {label: OSjs._('Close'), onClick: function(el, ev) {
      self._close();
    }}), buttonContainer);

    root.appendChild(buttonContainer);

    var notice = document.createElement('div');
    notice.className = 'Notice';
    notice.appendChild(document.createTextNode('If authentication fails you\'ll have to manually allow access via OS.js (Google will notify you by message automatically)'));
    root.appendChild(notice);

    return root;
  };

  /////////////////////////////////////////////////////////////////////////////
  // CHAT WINDOW
  /////////////////////////////////////////////////////////////////////////////

  var ChatWindow = function(id, contact, app, metadata) {
    var name = 'ApplicationChatWindow';
    Window.apply(this, [name + '_' + id, {width: 500, height: 450, tag: name}, app]);

    // Set window properties and other stuff here
    this.title  = metadata.name;
    this._title = this.title + ' - Conversation - ' + id;
    this._icon  = metadata.icon;

    this.id             = id;
    this.$textContainer = null;
    this.contact        = contact;
  };

  ChatWindow.prototype = Object.create(Window.prototype);

  ChatWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Create window contents (GUI) here
    this.$textContainer = document.createElement('div');
    this.$textContainer.className = 'ChatMessages';

    root.appendChild(this.$textContainer);

    var inputContainer = document.createElement('div');
    inputContainer.className = 'ChatInput';

    var id = this.id;
    var input = this._addGUIElement(new OSjs.GUI.Text('Input', {onKeyPress: function(ev) {
      ev = ev || {};
      if ( ev.keyCode === OSjs.Utils.Keys.ENTER ) {
        if ( app.sendMessage(input.getValue(), id, self) ) {
          input.setValue("");
        }
      }
    }}), inputContainer);

    this._addHook('focus', function() {
      if ( input ) {
        input.focus();
      }
    });

    root.appendChild(inputContainer);

    if ( this.contact ) {
      this.update(this.contact);
    }

    this._appRef.requestVcard(this.id);

    return root;
  };

  ChatWindow.prototype.insert = function(msg, remote, contact) {
    if ( !this.$textContainer ) { return; }

    var src = _getVcardImage(contact.vcard);
    var img = null;
    if ( src ) {
      img = document.createElement('img');
      img.src = src;
      img.alt = "";
    }

    var inner = document.createElement('div');

    var el = document.createElement('div');
    el.className = remote ? 'Remote' : 'Local';

    var header = document.createElement('h1');
    header.appendChild(document.createTextNode(contact.name));

    var timestamp = document.createElement('h2');
    timestamp.appendChild(document.createTextNode((new Date())));

    var message = document.createElement('p');
    message.appendChild(document.createTextNode(msg));

    inner.appendChild(header);
    inner.appendChild(timestamp);
    inner.appendChild(message);

    if ( img ) {
      el.className += ' HasAvatar';
      el.appendChild(img);
    }

    el.appendChild(inner);

    this.$textContainer.appendChild(el);
    this.$textContainer.scrollTop = this.$textContainer.scrollHeight;

    this.update(contact);
  };

  ChatWindow.prototype.update = function(contact) {
    this.contact = contact;

    if ( contact.name ) {
      this._setTitle(this.title + ' - Conversation - ' + contact.name);
    }
    this._setIcon(_getStatusIcon(contact.show));
  };

  /////////////////////////////////////////////////////////////////////////////
  // MAIN WINDOW
  /////////////////////////////////////////////////////////////////////////////

  var MainWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationChatMainWindow', {width: 300, height: 450}, app]);

    // Set window properties and other stuff here
    this._title = metadata.name + ' (WIP)';
    this._icon  = metadata.icon;

    this.menuBar          = null;
    this.contactList      = null;
    this.statusBar        = null;
    this.connectionState  = false;
  };

  MainWindow.prototype = Object.create(Window.prototype);

  MainWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Create window contents (GUI) here
    this.menuBar = this._addGUIElement(new GUI.MenuBar('ChatMenuBar'), root);
    this.menuBar.addItem({name: 'file', title: OSjs._("File")}, [
      {title: OSjs._('Close'), onClick: function() {
        self._close();
      }}
    ]);

    this.menuBar.addItem({name: 'account', title: OSjs._("Account")}, [
      {title: OSjs._('Settings'), onClick: function() {
        self.onOpenSettings();
      }},
      {title: OSjs._('Connect'), onClick: function() {
        app.connect();
      }},
      {title: OSjs._('Disconnect'), onClick: function() {
        app.disconnect();
      }},
      {title: OSjs._('Add contact'), disabled: true, onClick: function() {
        self.onAddContact();
      }},
      {title: OSjs._('Create group chat'), disabled: true, onClick: function() {
        self.onCreateGroupChat();
      }}
    ]);

    this.menuBar.addItem({name: 'status', title: OSjs._("Status")}, [
      {title: OSjs._('Online'), onClick: function() {
        self.onSetStatus('chat');
      }},
      {title: OSjs._('Away'), onClick: function() {
        self.onSetStatus('away');
      }},
      {title: OSjs._('Busy'), onClick: function() {
        self.onSetStatus('dnd');
      }}
    ]);

    this.menuBar.onMenuOpen = function(menu, mpos, mitem, menuBar) {
      if ( mitem.name == 'account' ) {
        if ( self.connectionState ) {
          menu.setItemDisabled(OSjs._('Connect'), true);
          menu.setItemDisabled(OSjs._('Disconnect'), false);
        } else {
          menu.setItemDisabled(OSjs._('Connect'), false);
          menu.setItemDisabled(OSjs._('Disconnect'), true);
        }
      }
    };

    this.contactList = this._addGUIElement(new GUI.ListView('ChatContactList', {indexKey: 'id'}), root);
    this.contactList.setColumns([
      {key: 'image',        title: '', type: 'image', domProperties: {width: "16"}},
      {key: 'name',         title: OSjs._('Contact')},
      {key: 'state',        title: OSjs._('Status'), domProperties: {width: "50"}},
      {key: 'id',           title: '', visible: false},
    ]);
    this.contactList.onActivate = function(ev, el, item) {
      if ( item )  {
        self.onContactOpened(item);
      }
    };
    this.contactList.onCreateRow = function(row, iter, colref) {
      row.title = OSjs.Utils.format("{0}\nGroup: {1}\nStatus: {2}", iter.name, iter.group || '<no group>', iter.state);
    };
    this.contactList.onContextMenu = function(ev, row, iter) {
      var list = [
        {name: 'Chat', title: OSjs._('Chat'), onClick: function() {
          self.onContactOpened(iter);
        }},
        {name: 'Delete', title: OSjs._('Delete'), disabled: true, onClick: function() {
          // TODO
        }},
        {name: 'Information', title: OSjs._('Information'), onClick: function() {
          self.onContactInfo(iter);
        }}
      ];

      OSjs.GUI.createMenu(list, {x: ev.clientX, y: ev.clientY});
    };

    this.contactList.render();

    this.statusBar = this._addGUIElement(new GUI.StatusBar('ChatStatusBar'), root);

    this.setConnectionState(false);
    this.setStatus('Set up your account and connect');
    return root;
  };

  MainWindow.prototype.onOpenSettings = function() {
    this._appRef.openSettingsWindow();
  };

  MainWindow.prototype.onSetStatus = function(s) {
    this._appRef.setOnlineStatus(s);
  };

  MainWindow.prototype.onContactInfo = function(item) {
    this._appRef.openUserInfoWindow(item.id);
  };

  MainWindow.prototype.onAddContact = function() {
    // TODO
  };

  MainWindow.prototype.onCreateGroupChat = function() {
    // TODO
  };

  MainWindow.prototype.onContactOpened = function(item) {
    this._appRef.openChatWindow(item.id);
  };

  MainWindow.prototype.setConnectionState = function(s) {
    if ( this.menuBar ) {
      var statusItem = this.menuBar.getItem('status');
      if ( statusItem ) {
        if ( s ) {
          statusItem.element.removeAttribute('disabled');
        } else {
          statusItem.element.setAttribute('disabled', 'disabled');
        }
      }
    }
    this.connectionState = s === true;
  }

  MainWindow.prototype.setStatus = function(s) {
    if ( this.statusBar ) {
      this.statusBar.setText(s || '');
    }
  };

  MainWindow.prototype.setContacts = function(list) {
    if ( this.contactList ) {
      var contacts = [];
      var iter;
      for ( var i in list ) {
        if ( list.hasOwnProperty(i) ) {
          iter = list[i];
          contacts.push({
            id:    i,
            name:  iter.name,
            group: iter.group,
            state: StatusDescriptions[iter.show],
            image: _getStatusIcon(iter.show)
          });
        }
      }
      this.contactList.setRows(contacts);
      this.contactList.render();
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // USER INFO WINDOW
  /////////////////////////////////////////////////////////////////////////////

  var UserInfoWindow = function(jid, contact, app, metadata) {
    Window.apply(this, ['ApplicationChatUserInfoWindow', {width: 400, height: 300}, app]);

    this.jid = jid;
    this.contact = contact;

    // Set window properties and other stuff here
    this._title = metadata.name + ' - vCard - ' + contact.name;
    this._icon  = metadata.icon;
    this._properties.allow_resize   = false;
    this._properties.allow_maximize = false;
    this._properties.allow_minimize = false;
  };

  UserInfoWindow.prototype = Object.create(Window.prototype);

  UserInfoWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    var textarea = this._addGUIElement(new GUI.Textarea('TextpadTextarea', {disabled: true}), root);

    var _setInfo = function(desc) {
      if ( !textarea ) { return; }

      var metadata = [];
      for ( var i in self.contact ) {
        if ( self.contact.hasOwnProperty(i) ) {
          if ( i == 'vcard' ) {
            if ( self.contact[i] ) {
              metadata.push("vcard name: " + self.contact[i].name);
              metadata.push("vcard url: " + self.contact[i].url);
              metadata.push("vcard photo: " + (self.contact[i].photo ? 'yes' : 'no'));
            }
            continue;
          } if ( typeof self.contact[i] === 'object' ) {
            metadata.push(i + ": " + JSON.stringify(self.contact[i]));
          } else {
            metadata.push(i + ": " + self.contact[i]);
          }
        }
      }
      textarea.setValue(desc + ":\n\n" + metadata.join("\n"));

      var src = _getVcardImage(self.contact.vcard);
      if ( src ) {
        var img = document.createElement('img');
        img.alt = '';
        img.src = src;
        root.appendChild(img);
      }
    };

    _setInfo("Requesting information for contact");

    this._appRef.requestVcard(this.jid, function(response) {
      _setInfo("Full user information");
    });

    return root;
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application constructor
   */
  var ApplicationChat = function(args, metadata) {
    var settings = {
      account : {
        configured: false,
        name:       'Anonymous',
        type:       'default',
        username:   '',
        password:   ''
      }
    };

    Application.apply(this, ['ApplicationChat', args, metadata, settings]);

    this.mainWindow = null;

    // You can set application variables here
    this.connected  = false;
    this.connection = null;
    this.contacts   = {};
    this.userid     = null;
    this.started    = false;
    this.vcard      = null;
  };

  ApplicationChat.prototype = Object.create(Application.prototype);

  ApplicationChat.prototype.destroy = function() {
    // Destroy communication, timers, objects etc. here
    this.disconnect();

    return Application.prototype.destroy.apply(this, arguments);
  };

  ApplicationChat.prototype.init = function(core, settings, metadata) {
    var self = this;

    Application.prototype.init.apply(this, arguments);

    // Create your main window
    this.mainWindow = this._addWindow(new MainWindow(this, metadata));

    // Do other stuff here
    // See 'DefaultApplication' sample in 'helpers.js' for more code
    var configure = true;
    if ( settings && settings.account ) {
      if ( settings.account.configured ) {
        configure = false;
      }
    }

    if ( configure ) {
      this.openSettingsWindow();
    } else {
      setTimeout(function() {
        self.connect();
      }, 200);
    }
  };

  ApplicationChat.prototype._onMessage = function(obj, msg, args) {
    Application.prototype._onMessage.apply(this, arguments);

    // Make sure we kill our application if main window was closed
    if ( msg == 'destroyWindow' && obj._name === 'ApplicationChatMainWindow' ) {
      this.mainWindow = null;
      this.destroy();
    }
  };

  //
  // Actions
  //

  ApplicationChat.prototype.connect = function() {
    this.disconnect();

    var self = this;
    var settings = this._getSetting('account') || {};
    if ( !settings.name || !settings.username || !settings.password ) {
      throw "Cannot connect, you need to configure your account!";
    }

    this.connection = new Strophe.Connection('/http-bind-jabber/');
    this.connection.rawInput = function(data) {
      self.onRawInput(data);
    };
    this.connection.rawOutput = function(data) {
      self.onRawOutput(data);
    };

    this.connection.connect(settings.username, settings.password, function(stat) {
      switch ( stat << 0 ) {
        case Strophe.Status.CONNECTING :
          self.onConnecting();
          break;

        case Strophe.Status.DISCONNECTING :
          self.onDisconnecting();
          break;

        case Strophe.Status.DISCONNECTED :
          self.onDisconnected();
          break;

        case Strophe.Status.AUTHFAIL :
          self.onAuthFailed();
          break;

        case Strophe.Status.CONNECTED :
          self.onConnected();
          break;

        default :
          console.warn("ApplicationChat::connect() -> onConnect()", "unknown state", stat);
        break;
      }
    });
  };

  ApplicationChat.prototype.disconnect = function() {
    if ( !this.connected ) { return; }

    if ( this.connection ) {
      this.connection.disconnect();
      this.connection = null;
    }

    this.connected = false;
    this.userid = null;
    this.started = false;

    var wins = this._getWindowsByTag('ApplicationChatWindow');
    for ( var i = 0; i < wins.length; i++ ) {
      this._removeWindow(wins[i]);
    }

    if ( this.mainWindow ) {
      this.mainWindow.setContacts({});
    }
  };

  ApplicationChat.prototype.sendMessage = function(message, userid, win) {
    if ( !this.connected || !this.connection ) { return false; }


    win = win || this.openChatWindow(userid);
    if ( win ) {
      win.insert(message, true, this.getAccountContact());
    }

    var reply = $msg({to: userid, from: this.userid, type: 'chat'})
                  .cnode(Strophe.xmlElement('body', message)).up()
                  .c('active', {xmlns: "http://jabber.org/protocol/chatstates"});

    console.debug("ApplicationChat::sendMessage()", reply);

    this.connection.send(reply.tree());

    return true;
  };

  ApplicationChat.prototype.openGroupChatWindow = function(id) {
    if ( !this.connected || !this.connection ) { return; }
    // TODO
  };

  ApplicationChat.prototype.openSettingsWindow = function() {
    var win = this._getWindowByName('ApplicationChatSettingsWindow');
    if ( win ) {
      win._restore();
      return;
    }

    win = this._addWindow(new SettingsWindow(this, this.__metadata));
    win._focus();
  };

  ApplicationChat.prototype.openChatWindow = function(id) {
    if ( !this.connected || !this.connection ) { return; }

    var win = this._getChatWindow(id);
    var contact = this.getContact(id);
    if ( win ) {
      win._restore();
      return win;
    }

    win = this._addWindow(new ChatWindow(id, this.contacts[id], this, this.__metadata));
    win._focus();
    return win;
  };

  ApplicationChat.prototype.openUserInfoWindow = function(id) {
    if ( !this.connected || !this.connection ) { return; }

    var win = this._addWindow(new UserInfoWindow(id, this.contacts[id], this, this.__metadata));
    win._focus();
    return win;
  };

  ApplicationChat.prototype.sendVcard = function() {
    if ( !this.connected || !this.connection ) { return; }

    /*
     * TODO
    var avatar = '';
    var iq = $iq({ type: 'set', to: this.userid }).c('vCard', { xmlns:'vcard-temp' }).c('PHOTO').c('EXTVAL', avatar);
    this.connection.sendIQ(iq);
    */
  };

  ApplicationChat.prototype._requestVcard = function(jid, callback) {
    callback = callback || function() {};

    var self = this;
    var iq = $iq({type: 'get', to: jid, id: this.connection.getUniqueId('vCard')})
                .c('vCard', {xmlns: 'vcard-temp'}).tree();

    this.connection.sendIQ(iq, function (response) {
      var elem = response.getElementsByTagName("vCard");
      var item = null;
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
          console.warn("vCard photo parse error", e);
        }

        item = {
          name:   fn,
          url:    url,
          photo:  photo
        };
      }

      callback.call(self, item);
    });
  };

  ApplicationChat.prototype.requestVcard = function(jid, callback) {
    if ( !this.connected || !this.connection ) { return; }
    console.debug("ApplicationChat::requestVcard()", jid);
    callback = callback || function() {};

    if ( this.contacts[jid] ) {
      if ( this.contacts[jid].vcard ) {
        callback.call(this, this.contacts[jid].vcard);
        return;
      }
    }

    this._requestVcard(jid, function(item) {
      if ( item ) {
        this.contacts[jid].vcard = item;
      }
      callback.call(this, item);
    });
  };

  //
  // Events
  //

  ApplicationChat.prototype.onAuthFailed = function() {
    alert("Authentication failed for Chat"); // FIXME
  };

  ApplicationChat.prototype.onRawInput = function(data) {
    // NOTE: Debugging
  };

  ApplicationChat.prototype.onRawOutput = function(data) {
    // NOTE: Debugging
  };

  ApplicationChat.prototype.onConnecting = function() {
    console.debug("ApplicationChat::onConnecting()");
    this.started = true;
    this.connected = false;
    if ( this.mainWindow ) {
      this.mainWindow.setStatus("Connecting...");
    }
  };

  ApplicationChat.prototype.onDisconnecting = function() {
    console.debug("ApplicationChat::onDisconnecting()");
    if ( this.mainWindow ) {
      this.mainWindow.setStatus("Disconnecting...");
    }
  };

  ApplicationChat.prototype.onDisconnected = function() {
    console.debug("ApplicationChat::onDisconnected()");
    if ( this.started && !this.connected ) {
      alert("Failed to connect to Chat server. For now see the Developer Console log, sorry!"); // FIXME
    }

    this.connected = false;
    //this.started = false;
    if ( this.mainWindow ) {
      this.mainWindow.setStatus("Disconnected!");
      this.mainWindow.setConnectionState(false);
    }
  };

  ApplicationChat.prototype.onConnected = function() {
    var self = this;

    console.debug("ApplicationChat::onConnected()");

    this.connected = true;
    this.userid = this.connection.jid;
    if ( this.mainWindow ) {
      this.mainWindow.setStatus("Connected :)");
    }
    this.mainWindow.setConnectionState(true);

    this.connection.addHandler(function(pres) {
      try {
        self.onPresence(pres);
      } catch ( e ) {
        console.error("ApplicationChat -> addHandler:presence", e);
        console.error(e.stack);
      }
      return true;
    }, null, 'presence', null, null,  null);

    this.connection.addHandler(function(msg) {
      try {
        self.onMessage(msg);
      } catch ( e ) {
        console.error("ApplicationChat -> addHandler:message", e);
        console.error(e.stack);
      }
      return true;
    }, null, 'message', null, null,  null);

    this.connection.addHandler(function(x) {
      console.warn("XXX", x);
      return true;
    }, "jabber:iq:roster", "iq", "set");

    this.connection.send($pres().tree());

    this._requestVcard(this.userid, function(item) {
      self.vcard = item || null;
    });
  };

  ApplicationChat.prototype.onIQ = function(iq) {
    console.debug("ApplicationChat::onIQ()");

    var items = iq.getElementsByTagName('item');
    if ( items.length ) {
      var jid, name, win, groups;
      for ( var i = 0; i < items.length; i++ ) {
        win = null;
        jid = items[i].getAttribute('jid');
        name = items[i].getAttribute('name');
        groups = items[i].getElementsByTagName('group');

        /*
           <item jid="jid here" name="Full name" subscription="both">
             <group>Group Name</group>
           </item>
         */

        if ( this.contacts[jid] ) {
          if ( name && name.length ) {
            this.contacts[jid].name = name;
          }
          if ( groups.length ) {
            this.contacts[jid].group = Strophe.getText(groups[0]) || null;
          }
          win = this._getChatWindow(jid);
        }

        if ( win ) {
          win.update(this.contacts[jid]);
        }
      }

      if ( this.mainWindow ) {
        this.mainWindow.setContacts(this.contacts);
      }
    }
  };

  ApplicationChat.prototype.onPresence = (function() {
    var _renderTimeout;

    var _render = function(self) {
      if ( this.mainWindow ) {
        this.mainWindow.setContacts(this.contacts);
      }

      var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
      this.connection.sendIQ(iq, function(iq) {
        self.onIQ(iq);
      });
    };

    return function(pres) {
      console.debug("ApplicationChat::onPresence()");

      /*
<presence xmlns="jabber:client" to="myself@something" from="otheruser@something">
  <show>away</show>
  <caps:c xmlns:caps="http://jabber.org/protocol/caps" node="http://www.android.com/gtalk/client/caps" ver="1.1"></caps:c>
  <x xmlns="vcard-temp:x:update">
    <photo>some hash here</photo>
  </x>
</presence>
*/

      var from  = pres.getAttribute('from'); // Contact
      var to    = pres.getAttribute('to');   // Myself
      var type  = pres.getAttribute('type');
      var photo = null;


      if ( !to ) { return; }

      var elems = pres.getElementsByTagName('show');
      var test  = elems.length ? Strophe.getText(elems[0]) : '';
      var show  = test.length ? test : (type === 'unavailable' ? 'offline' : 'chat');
      var jid   = from.split('/')[0];

      elems = pres.getElementsByTagName('photo');
      if ( elems.length && elems[0] ) {
        photo = Strophe.getText(elems[0]) || null;
      }

      if ( !this.contacts[jid] ) {
        this.contacts[jid] = {};
      }

      this.contacts[jid].id      = jid;
      this.contacts[jid].account = to;
      this.contacts[jid].show    = show;
      this.contacts[jid].photo   = photo;

      if ( !this.contacts[jid].vcard ) {
        this.contacts[jid].vcard = null;
      }
      if ( !this.contacts[jid].group ) {
        this.contacts[jid].group = null;
      }
      if ( !this.contacts[jid].name ) {
        this.contacts[jid].name  = jid;
      }

      var self = this;
      if ( _renderTimeout ) {
        clearTimeout(_renderTimeout);
        _renderTimeout = null;
      }

      _renderTimeout = setTimeout(function() {
        _render.call(self, self);
      }, 100);

    };
  })();

  ApplicationChat.prototype.onMessage = function(msg) {
    var elems = msg.getElementsByTagName('body');

    console.debug("ApplicationChat::onMessage()", msg);

    if ( elems.length > 0 ) {
      var to      = msg.getAttribute('to');
      var from    = msg.getAttribute('from');
      var type    = msg.getAttribute('type');
      var message = Strophe.getText(elems[0]);

      var jid     = from.split('/')[0];
      var win     = this.openChatWindow(jid);

      if ( type == "chat" ) {
        win.insert(message, false, this.getContact(jid));
      } else if ( type == "error" ) {
        var error = msg.getElementsByTagName('error')[0];
        console.error("ApplicationChat::onMessage()", 'error', error, msg);
        win.insert(OSjs.Utils.format("Error sending message ({0}): {1}", 
                                     error.getAttribute('code'),
                                     message), true, this.getAccountContact());
      }
    }
  };

  //
  // Getters
  //

  ApplicationChat.prototype._getChatWindow = function(id) {
    return this._getWindowByName('ApplicationChatWindow_' + id);
  };

  ApplicationChat.prototype.getContact = function(jid) {
    if ( this.contacts[jid] ) {
      return this.contacts[jid];
    }
    return {id: '', name: 'unknown', account: '', show: 'offline'};
  };

  ApplicationChat.prototype.getAccountContact = function() {
    var settings = this._getSetting('account') || {};
    return {
      id: this.userid,
      name: settings.name || this.userid,
      show: 'offline',
      account: '',
      vcard: this.vcard
    };
  };

  ApplicationChat.prototype.setOnlineStatus = function(s) {
    if ( !this.connected || !this.connection ) { return; }
    console.debug("ApplicationChat::setOnlineStatus()", s);

    this.connection.send($pres({
      show: s/*,
      status: 'text'
      */
    }).tree());
  };

  ApplicationChat.prototype.setAccountSettings = function(s) {
    this._setSetting('account', s, true);

    this.connect();
  };

  //
  // EXPORTS
  //
  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationChat = ApplicationChat;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs);
