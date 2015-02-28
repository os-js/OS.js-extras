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
(function(Application, Window, GUI, Dialogs) {

  // https://www.webrtc-experiment.com/meeting/
  // TODO: Update room list periodicaly

  /////////////////////////////////////////////////////////////////////////////
  // ABOUT WINDOW
  /////////////////////////////////////////////////////////////////////////////

  var AboutWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationRTCGroupVideoAboutWindow', {width: 350, height: 150, min_height: 150}, app]);

    // Set window properties and other stuff here
    this._title = metadata.name + ' - About';
    this._icon  = metadata.icon;
    this._properties.allow_resize = false;
    this._properties.allow_maximize = false;
  };

  AboutWindow.prototype = Object.create(Window.prototype);

  AboutWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    var header = document.createElement('h1');
    header.innerHTML = 'About WebRTC Group Video';

    var textarea = document.createElement('div');
    textarea.innerHTML = '<span>Created by Anders Evenrud</span><br />';
    textarea.innerHTML += '<br />';
    textarea.innerHTML += '<a href="https://github.com/muaz-khan/WebRTC-Experiment" target="_blank">Using WebRTC-Experiment code</a>';

    root.appendChild(header);
    root.appendChild(textarea);

    return root;
  };

  /////////////////////////////////////////////////////////////////////////////
  // USER MEDIA WINDOW
  /////////////////////////////////////////////////////////////////////////////

  /**
   * UserMedia Window Constructor
   */
  var UserMediaWindow = function(app, metadata) {
    Window.apply(this, ['UserMediaWindow', {width: 500, height: 300}, app]);

    // Set window properties and other stuff here
    this._title = OSjs.Utils.format('{0} - {1}', metadata.name, 'Local Video');
    this._icon  = 'status/user-available.png';

    this.inited = false;
    this.video = null;
    this._properties.allow_close = false;
    this._properties.allow_maximize = false;
  };

  UserMediaWindow.prototype = Object.create(Window.prototype);

  UserMediaWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    return root;
  };

  UserMediaWindow.prototype.setup = function(video) {
    if ( this.inited ) {
      return;
    }
    this._getRoot().appendChild(video);
    this.video = video;
    this.inited = true;

    this._resize();
  };

  UserMediaWindow.prototype._resize = function(w, h) {
    if ( !Window.prototype._resize.apply(this, arguments) ) return false;

    if ( this.video ) {
      var root = this._getRoot();
      this.video.width = root.offsetWidth;
      this.video.height = root.offsetHeight;
    }

    return true;
  };

  /////////////////////////////////////////////////////////////////////////////
  // CONFERENCE WINDOW
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Conference Window Constructor
   */
  var ConferenceWindow = function(app, metadata, id) {
    Window.apply(this, ['ConferenceWindow_' + id, {width: 500, height: 300, tag: 'Window_ConferenceWindow'}, app]);

    // Set window properties and other stuff here
    this._title = OSjs.Utils.format('{0} - {1} ({2})', metadata.name, 'Remote Video', id);
    this._icon  = 'status/user-available.png';
    this._properties.allow_close = false;
    this._properties.allow_maximize = false;

    this.video = null;
  };

  ConferenceWindow.prototype = Object.create(Window.prototype);

  ConferenceWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    return root;
  };

  ConferenceWindow.prototype.setup = function(video) {
    this._getRoot().appendChild(video);
    this.video = video;

    this._resize();
  };

  ConferenceWindow.prototype._resize = function(w, h) {
    if ( !Window.prototype._resize.apply(this, arguments) ) return false;

    if ( this.video ) {
      var root = this._getRoot();
      this.video.width = root.offsetWidth;
      this.video.height = root.offsetHeight;
    }

    return true;
  };

  /////////////////////////////////////////////////////////////////////////////
  // MAIN WINDOW
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Main Window Constructor
   */
  var ApplicationRTCGroupVideoWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationRTCGroupVideoWindow', {width: 500, height: 300}, app]);

    // Set window properties and other stuff here
    this._title = metadata.name + " (WIP)";
    this._icon  = metadata.icon;

    this.menuBar      = null;
    this.listView     = null;
    this.statusBar    = null;
  };

  ApplicationRTCGroupVideoWindow.prototype = Object.create(Window.prototype);

  ApplicationRTCGroupVideoWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Create window contents (GUI) here
    this.menuBar = this._addGUIElement(new GUI.MenuBar('RTCGroupVideoMenuBar'), root);
    this.menuBar.addItem({name: 'file', title: OSjs.API._("LBL_FILE")}, [
      {title: OSjs.API._('LBL_CLOSE'), onClick: function() {
        self._close();
      }}
    ]);
    this.menuBar.addItem({name: 'create', title: OSjs.API._("Create Room")});
    this.menuBar.addItem({name: 'leave', title: OSjs.API._("Leave Room")});
    this.menuBar.addItem({name: 'help', title: OSjs.API._("LBL_HELP")}, [
      {title: OSjs.API._('LBL_ABOUT'), onClick: function() {
        self.onOpenAbout();
      }}
    ]);

    this.menuBar.onMenuOpen = function(menu, pos, item) {
      if ( typeof item === 'string' ) { return; } // Backward compability
      if ( item.name == 'create' ) {
        self.onCreateSelect();
      } else if ( item.name == 'leave' ) {
        self.onDestroySelect();
      }
    };

    this.listView = this._addGUIElement(new GUI.ListView('RTCGroupVideoRoomList'), root);
    this.listView.setColumns([
      {key: 'roomid',       title: OSjs.API._('Room ID')},
      {key: 'join',         title: '', type: 'button', width: 40}
    ]);

    this.listView.render();

    this.statusBar = this._addGUIElement(new GUI.StatusBar('RTCGroupVideoStatus'), root);
    this.statusBar.setText();

    return root;
  };

  ApplicationRTCGroupVideoWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);

    // Window has been successfully created and displayed.
    // You can start communications, handle files etc. here
  };

  ApplicationRTCGroupVideoWindow.prototype.destroy = function() {
    // Destroy custom objects etc. here

    Window.prototype.destroy.apply(this, arguments);
  };

  ApplicationRTCGroupVideoWindow.prototype.onOpenAbout = function() {
    this._appRef.openAboutWindow();
  };

  ApplicationRTCGroupVideoWindow.prototype.onCreateSelect = function() {
    var self = this;

    if ( this._appRef.hasCreatedRoom() ) {
      alert("Cannot create a room, you have already created one!");
      return;
    }
    if ( this._appRef.hasJoinedRoom() ) {
      alert("Cannot create a room, you are currently joined in another!");
      return;
    }

    // Input dialog
    this._appRef._createDialog('Input', ["Room name", ("Room_" + (new Date()).getTime()), function(btn, value) {
      self._focus();
      if ( btn !== 'ok' || !value ) return;
      self._appRef.createRoom(value);
    }], this);
  };

  ApplicationRTCGroupVideoWindow.prototype.onDestroySelect = function() {
    this._appRef.disconnect();
  };

  ApplicationRTCGroupVideoWindow.prototype.updateStatus = function(txt) {
    if ( this.statusBar ) {
      this.statusBar.setText(txt);
    }

    if ( this.menuBar ) {
      if ( this._appRef.hasCreatedRoom() || this._appRef.hasJoinedRoom() ) {
        this.menuBar.getItem('create').element.setAttribute('disabled', 'disabled');
        this.menuBar.getItem('leave').element.removeAttribute('disabled');
      } else {
        this.menuBar.getItem('leave').element.setAttribute('disabled', 'disabled');
        this.menuBar.getItem('create').element.removeAttribute('disabled');
      }
    }
  };

  ApplicationRTCGroupVideoWindow.prototype.updateRooms = function(list, evRef) {
    if ( this.listView ) {
      var rows = [];
      for ( var i = 0; i < list.length; i++ ) {
        rows.push({
          roomid: list[i].roomid,
          join: 'Join',
          customEvent: (function(room) { // For button
            return function() {
              evRef(room);
            };
          })(list[i])
        });
      }

      this.listView.setRows(rows);
      this.listView.render();
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application constructor
   */
  var ApplicationRTCGroupVideo = function(args, metadata) {
    Application.apply(this, ['ApplicationRTCGroupVideo', args, metadata]);

    // You can set application variables here
    this.mainWindow = null;

    this.roomCreated  = false;
    this.roomJoined   = false;
    this.rooms        = [];
    this.users        = [];
    this.meeting      = null;
  };

  ApplicationRTCGroupVideo.prototype = Object.create(Application.prototype);

  ApplicationRTCGroupVideo.prototype.destroy = function() {
    // Destroy communication, timers, objects etc. here
    if ( this.meeting ) {
      this.disconnect();
      this.meeting = null;
    }

    return Application.prototype.destroy.apply(this, arguments);
  };

  ApplicationRTCGroupVideo.prototype.init = function(settings, metadata) {
    var self = this;

    Application.prototype.init.apply(this, arguments);

    // Create your main window
    this.mainWindow = this._addWindow(new ApplicationRTCGroupVideoWindow(this, metadata));

    // Do other stuff here
    this.meeting = new Meeting();

    this.meeting.onmeeting = function(room) {
      self.onUpdateRooms(room);
    };

    this.meeting.onaddstream = function (e) {
      if (e.type == 'local') {
        self.onAddStreamLocal(e.video);
      }
      if (e.type == 'remote') {
        self.onAddStreamRemote(e.video);
      }
    };

    this.meeting.openSignalingChannel = function(onmessage) {
      var channel = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
      var websocket = new WebSocket('ws://wsnodejs.jit.su:80');
      websocket.onopen = function () {
        websocket.push(JSON.stringify({
          open: true,
          channel: channel
        }));
      };
      websocket.push = websocket.send;
      websocket.send = function (data) {
        if(websocket.readyState != 1) {
          return setTimeout(function() {
            websocket.send(data);
          }, 300);
        }

        websocket.push(JSON.stringify({
          data: data,
          channel: channel
        }));
      };
      websocket.onmessage = function(e) {
        onmessage(JSON.parse(e.data));
      };
      return websocket;
    };

    this.meeting.onuserleft = function(userid) {
      self.onUserLeft(userid);
    };

    this.meeting.check();
    this.mainWindow.updateStatus("Create a new room or join from list");
  };

  ApplicationRTCGroupVideo.prototype._onMessage = function(obj, msg, args) {
    Application.prototype._onMessage.apply(this, arguments);

    // Make sure we kill our application if main window was closed
    if ( msg == 'destroyWindow' && obj._name === 'ApplicationRTCGroupVideoWindow' ) {
      this.mainWindow = null;
      this.destroy();
    }
  };

  //
  // Actions
  //

  ApplicationRTCGroupVideo.prototype.openAboutWindow = function() {
    var win = this._getWindowByName('ApplicationRTCGroupVideoAboutWindow');
    if ( win ) {
      win._restore();
      return;
    }

    win = this._addWindow(new AboutWindow(this, this.__metadata));
    win._focus();
  };

  ApplicationRTCGroupVideo.prototype.joinRoom = function(room) {
    if ( !this.meeting ) {
      alert("Cannot join a room, RTCGroupVideo is not initialized");
      return;
    }
    if ( this.roomJoined ) {
      alert("Cannot join a room, you are already in one!");
      return;
    }
    if ( this.roomCreated ) {
      alert("Cannot join a room, you created one!");
      return;
    }

    this.meeting.meet(room);
    this.roomJoined = true;

    this.mainWindow.updateStatus(OSjs.Utils.format("Joined room '{0}'", room.roomid));
  };

  ApplicationRTCGroupVideo.prototype.createRoom = function(name) {
    if ( !this.meeting ) { return; }
    if ( this.roomCreated ) { return; }
    if ( this.roomJoined ) { return; }

    name = name || 'Anonymous';
    console.warn(">>>", "ApplicationRTCGroupVideo::createRoom()", name);

    this.meeting.setup(name);
    this.roomCreated = true;

    this.mainWindow.updateStatus(OSjs.Utils.format("Created room '{0}', waiting for users", name));
  };

  ApplicationRTCGroupVideo.prototype.disconnect = function() {
    //if ( this.roomCreated || this.roomJoined ) {
      console.warn(">>>", "ApplicationRTCGroupVideo::disconnect()");

      this.roomCreated = false;
      this.roomJoined = false;

      if ( this.meeting ) {
        this.meeting.leave();
      }
      if ( this.mainWindow ) {
        /*
        var win = this.mainWindow._getChildByName('UserMediaWindow');
        if ( win ) {
          this.mainWindow._removeChild(win);
        }
        */
        this.mainWindow._removeChildren();

        this.mainWindow.updateStatus("Create a new room or join from list");
      }
    //}
  };

  //
  // Misc
  //

  ApplicationRTCGroupVideo.prototype.hasJoinedRoom = function() {
    return this.roomJoined;
  };

  ApplicationRTCGroupVideo.prototype.hasCreatedRoom = function() {
    return this.roomCreated;
  };

  //
  // Events
  //

  ApplicationRTCGroupVideo.prototype.onUserLeft = function(id) {
    console.warn(">>>", "ApplicationRTCGroupVideo::onUserLeft()", id);

    if ( this.mainWindow ) {
      var win = this.mainWindow._getChildByName('ConferenceWindow_' + id);
      if ( win ) {
        this.mainWindow._removeChild(win);
      }
    }

    if ( this.roomJoined ) {
      this.roomJoined = false;
    }
  };

  ApplicationRTCGroupVideo.prototype.onAddStreamRemote = function(video) {
    console.warn(">>>", "ApplicationRTCGroupVideo::onAddStreamRemote()", video);

    if ( this.mainWindow ) {
      var win = new ConferenceWindow(this, this.__metadata, video.id);
      this.mainWindow._addChild(win, true);
      win.setup(video);
    }
  };

  ApplicationRTCGroupVideo.prototype.onAddStreamLocal = function(video) {
    console.warn(">>>", "ApplicationRTCGroupVideo::onAddStreamLocal()", video);

    if ( this.mainWindow ) {
      var win = this.mainWindow._getChildByName('UserMediaWindow');
      if ( !win ) {
        win = new UserMediaWindow(this, this.__metadata);
        this.mainWindow._addChild(win, true);
        win.setup(video);
      }
    }
  };

  ApplicationRTCGroupVideo.prototype.onUpdateRooms = function(room) {

    for ( var i = 0; i < this.rooms.length; i++ ) {
      if ( this.rooms[i].roomid == room.roomid ) {
        return;
      }
    }
    console.warn(">>>", "ApplicationRTCGroupVideo::onUpdateRooms()", room);
    this.rooms.push(room);

    if ( this.mainWindow ) {
      var self = this;
      this.mainWindow.updateRooms(this.rooms, function(room) {
        self.joinRoom(room);
      });
    }
  };

  //
  // EXPORTS
  //
  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationRTCGroupVideo = ApplicationRTCGroupVideo;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs);
