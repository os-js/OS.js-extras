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
(function(Application, Window, GUI, Dialogs, Utils, API, VFS) {

  var pullContacts = (function() {
    var ginst;
    function connect(cb) {
      if ( ginst ) {
        cb(false, true);
        return;
      }

      var scope = ['https://www.googleapis.com/auth/contacts.readonly'];
      OSjs.Helpers.GoogleAPI.createInstance({scope: scope}, function(error, result, inst) {
        ginst = inst;
        cb(error, error ? false : true);
      });
    }

    function parseContacts(list) {
      var parsed = [];
      var entries = list.feed ? list.feed.entry : [];
      entries.forEach(function(e) {
        var emails = [];
        var name = e.gd$name || {};

        (e.gd$email || []).forEach(function(ee) {
          emails.push(ee.address);
        });

        if ( emails.length ) {
          var item = {
            id: e.id.$t,
            title: e.title.$t,
            emails: emails,
            names: {
              givenName: name.gd$givenName ? name.gd$givenName.$t : '',
              familyName: name.gd$familyName ? name.gd$familyName.$t : '',
              additionalName: name.gd$additionalName ? name.gd$additionalName.$t : '',
              fullName: name.gd$fullName ? name.gd$fullName.$t : ''
            }
          };

          if ( !item.title && item.names.fullName ) {
            item.title = item.names.fullName;
          }
          if ( !item.title && item.names.givenName ) {
            item.title = item.names.givenName;
          }

          parsed.push(item);
        }
      });

      parsed.sort(function(a, b){
        var keyA = a.title, //new Date(a.date),
            keyB = b.title; //new Date(b.date);

        if(keyA < keyB) return -1;
        if(keyA > keyB) return 1;
        return 0;
      });

      return parsed;
    }

    function getContacts(cb) {
      var t = (ginst||{}).accessToken;
      if ( !ginst || !t ) {
        cb('Google API instance was not created or invalid token!');
        return;
      }

      var cbName = 'googleplugin_callback';
      window[cbName] = function(data) {
        delete window[cbName];
        cb(false, parseContacts(data));
      };

      Utils.ajax({
        url: 'https://www.google.com/m8/feeds/contacts/default/full?alt=json&access_token=' + t + '&max-results=700&v=3.0&callback=' + cbName,
        jsonp: true,
        onerror: function() {
          cb('Failed to fetch contacts from google');
        }
      });
    }

    return function(callback) {
      connect(function(error) {
        if ( error ) {
          callback(error);
          return;
        }

        getContacts(function(error, result) {
          callback(error, result);
        });
      });
    };
  })();

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Main Window Constructor
   */
  var ApplicationGoogleContactsWindow = function(app, metadata, scheme) {
    Window.apply(this, ['ApplicationGoogleContactsWindow', {
      icon: metadata.icon,
      title: metadata.name,
      width: 400,
      height: 200
    }, app, scheme]);
  };

  ApplicationGoogleContactsWindow.prototype = Object.create(Window.prototype);

  ApplicationGoogleContactsWindow.prototype.init = function(wmRef, app, scheme) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    scheme.render(this, 'ApplicationGoogleContactsWindow', root);

    scheme.find(this, 'View').on('activate', function(ev) {
      self.activateContact(ev.detail.entries[0].data);
    });
    scheme.find(this, 'Refresh').on('select', function() {
      app.sync();
    });

    return root;
  };

  ApplicationGoogleContactsWindow.prototype.renderGoogleContacts = function(contacts) {
    contacts = contacts || [];

    var rows = [];
    contacts.forEach(function(c) {
      rows.push({
        value: c,
        columns: [
          {label: c.title},
          {label: (c.emails ? c.emails[0] : '')}
        ]
      });
    });

    var view = this._scheme.find(this, 'View');
    view.clear().add(rows);
  };

  ApplicationGoogleContactsWindow.prototype.editContact = function(contact) {
    if ( !contact ) { return; }
    console.debug('editContact', contact);
  };

  ApplicationGoogleContactsWindow.prototype.deleteContact = function(contact) {
    if ( !contact ) { return; }
    console.debug('deleteContact', contact);
  };

  ApplicationGoogleContactsWindow.prototype.createContact = function() {
    console.debug('createContact');
  };

  ApplicationGoogleContactsWindow.prototype.activateContact = function(contact) {
    if ( !contact ) { return; }
    console.debug('activateContact', contact);
    if ( !contact.emails.length ) { return; }

    API.launch('ApplicationGmail', {
      action: 'create',
      title: contact.title,
      email: contact.emails[0]
    });
  };

  ApplicationGoogleContactsWindow.prototype.getSelectedContact = function() {
    var view = this.contactView;
    if ( view ) {
      return view.getSelected();
    }

    return false;
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationGoogleContacts(args, metadata) {
    Application.apply(this, ['ApplicationGoogleContacts', args, metadata]);
  }

  ApplicationGoogleContacts.prototype = Object.create(Application.prototype);

  ApplicationGoogleContacts.prototype.init = function(settings, metadata) {
    Application.prototype.init.apply(this, arguments);

    var self = this;
    var url = API.getApplicationResource(this, './scheme.html');
    var scheme = GUI.createScheme(url);
    scheme.load(function(error, result) {
      self._addWindow(new ApplicationGoogleContactsWindow(self, metadata, scheme));
      self.sync();
    });

    this._setScheme(scheme);
  };

  ApplicationGoogleContacts.prototype.sync = function() {
    var mainWindow = this.__windows[0];

    mainWindow._toggleLoading(true);
    pullContacts(function(error, result) {
      if ( error ) {
        API.error('Google Calendar Error', 'An error occured while getting contacts', error);
      }

      if ( mainWindow ) {
        mainWindow._toggleLoading(false);
        if ( result ) {
          mainWindow.renderGoogleContacts(result);
        }
      }
    });
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationGoogleContacts = OSjs.Applications.ApplicationGoogleContacts || {};
  OSjs.Applications.ApplicationGoogleContacts.Class = ApplicationGoogleContacts;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
