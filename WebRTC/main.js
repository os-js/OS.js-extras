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

  // https://www.webrtc-experiment.com/meeting/
  // https://github.com/muaz-khan/WebRTC-Experiment/tree/master/video-conferencing
  // TODO: Update room list periodicaly

  /////////////////////////////////////////////////////////////////////////////
  // USER MEDIA WINDOW
  /////////////////////////////////////////////////////////////////////////////

  /**
   * UserMedia Window Constructor
   */
  var UserMediaWindow = function(app, metadata) {
    Window.apply(this, ['UserMediaWindow', {width: 500, height: 300}, app]);

    // Set window properties and other stuff here
    this._title = 'WebRTC - Local Video';
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
    Window.apply(this, ['ConferenceWindow_' + id, {width: 500, height: 300}, app]);

    // Set window properties and other stuff here
    this._title = OSjs.Utils.format('WebRTC - Remote Video ({0})', id);
    this._icon  = 'status/user-available.png';
    this._properties.allow_close = false;
    this._properties.allow_maximize = false;

    this.video = null;
  };

  ConferenceWindow.prototype = Object.create(Window.prototype);

  ConferenceWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    root.className += ' ConferenceWindow';
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
  var ApplicationWebRTCWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationWebRTCWindow', {width: 500, height: 300}, app]);

    // Set window properties and other stuff here
    this._title = metadata.name + " (WIP)";
    this._icon  = metadata.icon;

    this.roomCreated  = false;
    this.roomJoined   = false;
    this.rooms        = [];
    this.users        = [];
    this.meeting      = null;
    this.listView     = null;
    this.statusBar    = null;
  };

  ApplicationWebRTCWindow.prototype = Object.create(Window.prototype);

  ApplicationWebRTCWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Create window contents (GUI) here
    var menuBar = this._addGUIElement(new GUI.MenuBar('WebRTCMenuBar'), root);
    menuBar.addItem(OSjs._("File"), [
      {title: OSjs._('Close'), onClick: function() {
        self._close();
      }}
    ]);
    menuBar.addItem(OSjs._("Create Room"));
    menuBar.addItem(OSjs._("Leave Room"));

    menuBar.onMenuOpen = function(menu, pos, title) {
      if ( title == OSjs._("Create Room") ) {
        self.onCreateSelect();
      } else if ( title == OSjs._("Leave Room") ) {
        self.onDestroySelect();
      }
    };

    this.listView = this._addGUIElement(new GUI.ListView('WebRTCRoomList'), root);
    this.listView.setColumns([
      {key: 'roomid',       title: OSjs._('Room ID')},
      {key: 'join',         title: '', type: 'button', domProperties: {width: "40"}}
    ]);

    this.listView.render();

    this.statusBar = this._addGUIElement(new GUI.StatusBar('WebRTCStatus'), root);
    this.statusBar.setText("Create a new room or join from list");

    return root;
  };

  ApplicationWebRTCWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);

    // Window has been successfully created and displayed.
    // You can start communications, handle files etc. here

    var self = this;

    this.meeting = new Meeting();

    this.meeting.onmeeting = function(room) {
      self._updateRooms(room);
    };

    this.meeting.onaddstream = function (e) {
      if (e.type == 'local') {
        self._createLocalStream(e.video);
      }

      if (e.type == 'remote') {
        self._createRemoteStream(e.video);
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
      self._removeRemoteStream(userid);
    };

    this.meeting.check();
  };

  ApplicationWebRTCWindow.prototype.destroy = function() {
    // Destroy custom objects etc. here
    this._leaveSession();
    this._destroySession();

    this.meeting = null;

    Window.prototype.destroy.apply(this, arguments);
  };

  ApplicationWebRTCWindow.prototype._removeRemoteStream = function(id) {
    console.warn(">>>", "ApplicationWebRTCWindow::_removeRemoteStream()", id);

    var win = this._getChild('ConferenceWindow_' + id);
    if ( win ) {
      this._removeChild(win);
    }

    if ( this.roomJoined ) {
      this.roomJoined = false;
    }
  };

  ApplicationWebRTCWindow.prototype._createRemoteStream = function(video) {
    console.warn(">>>", "ApplicationWebRTCWindow::_createRemoteStream()", video);

    var win = new ConferenceWindow(this._appRef, null, video.id);
    this._addChild(win, true);
    win.setup(video);
  };

  ApplicationWebRTCWindow.prototype._createLocalStream = function(video) {
    console.warn(">>>", "ApplicationWebRTCWindow::_createLocalStream()", video);

    var win = this._getChild('UserMediaWindow');
    if ( !win ) {
      win = new UserMediaWindow(this._appRef, null);
      this._addChild(win, true);
      win.setup(video);
    }
  };

  ApplicationWebRTCWindow.prototype._leave = function() {
    if ( this.meeting ) {
      this.meeting.leave();
      this.statusBar.setText("Create a new room or join from list");
    }

    var win = this._getChild('UserMediaWindow');
    if ( win ) {
      this._removeChild(win);
    }
  };

  ApplicationWebRTCWindow.prototype._leaveSession = function() {
    if ( this.roomJoined ) {
      console.warn(">>>", "ApplicationWebRTCWindow::_leaveSession()");
      this._leave();
      this.roomJoined = false;
    }
  };

  ApplicationWebRTCWindow.prototype._destroySession = function() {
    if ( this.roomCreated ) {
      console.warn(">>>", "ApplicationWebRTCWindow::_destroySession()");
      this._leave();
      this.roomCreated = false;
    }
  };

  ApplicationWebRTCWindow.prototype._updateRooms = function(room) {
    console.warn(">>>", "ApplicationWebRTCWindow::_updateRooms()", room);

    var self = this;

    for ( var i = 0; i < this.rooms.length; i++ ) {
      if ( this.rooms[i].roomid == room.roomid ) {
        return;
      }
    }

    this.rooms.push({
      roomid: room.roomid,
      join: 'Join',
      customEvent: function() { // For button
        if ( self.roomJoined ) {
          alert("Cannot join a room, you are already in one!");
          return;
        }
        if ( self.roomCreated ) {
          alert("Cannot join a room, you created one!");
          return;
        }

        self.meeting.meet(room);
        self.statusBar.setText("Joined room: " + room.roomid);
        self.roomJoined = true;
      }
    });

    if ( this.listView ) {
      this.listView.setRows(this.rooms);
      this.listView.render();
    }
  };

  ApplicationWebRTCWindow.prototype.onCreateSelect = function() {
    if ( this.roomCreated ) {
      alert("Cannot create a room, you have already created one!");
      return;
    }
    if ( this.roomJoined ) {
      alert("Cannot create a room, you are currently joined in another!");
      return;
    }

    var self = this;
    var _create = function(name) {
      name = name || 'Anonymous';

      console.warn("WebRTC", "Create new", name);

      self.meeting.setup(name);

      self.roomCreated = true;
      self.statusBar.setText("Room created: " + name + ", waiting for users...");
    };

    // Input dialog
    this._appRef._createDialog('Input', ["Room name", ("Room_" + (new Date()).getTime()), function(btn, value) {
      self._focus();
      if ( btn !== 'ok' || !value ) return;
      _create(value);
    }], this);
  };

  ApplicationWebRTCWindow.prototype.onDestroySelect = function() {
    this._leaveSession();
    this._destroySession();
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application constructor
   */
  var ApplicationWebRTC = function(args, metadata) {
    Application.apply(this, ['ApplicationWebRTC', args, metadata]);

    // You can set application variables here
    this.mainWindow = null;
  };

  ApplicationWebRTC.prototype = Object.create(Application.prototype);

  ApplicationWebRTC.prototype.destroy = function() {
    // Destroy communication, timers, objects etc. here

    return Application.prototype.destroy.apply(this, arguments);
  };

  ApplicationWebRTC.prototype.init = function(core, session, metadata) {
    var self = this;

    Application.prototype.init.apply(this, arguments);

    // Create your main window
    this.mainWindow = this._addWindow(new ApplicationWebRTCWindow(this, metadata));

    // Do other stuff here
    // See 'DefaultApplication' sample in 'helpers.js' for more code
  };

  ApplicationWebRTC.prototype._onMessage = function(obj, msg, args) {
    Application.prototype._onMessage.apply(this, arguments);

    // Make sure we kill our application if main window was closed
    if ( msg == 'destroyWindow' && obj._name === 'ApplicationWebRTCWindow' ) {
      this.mainWindow = null;
      this.destroy();
    }
  };

  //
  // EXPORTS
  //
  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationWebRTC = ApplicationWebRTC;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs);
