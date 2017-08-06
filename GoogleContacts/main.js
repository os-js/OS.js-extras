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
import Promise from 'bluebird';
import jsonp from 'then-jsonp';

const Window = OSjs.require('core/window');
const Application = OSjs.require('core/application');
const GoogleAPI = OSjs.require('helpers/google-api');

var pullContacts = (function() {
  var ginst;
  function connect(cb) {
    if ( ginst ) {
      cb(false, true);
      return;
    }

    var scope = ['https://www.googleapis.com/auth/contacts.readonly'];
    GoogleAPI.create({scope: scope}, function(error, result, inst) {
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

    parsed.sort(function(a, b) {
      var keyA = a.title; //new Date(a.date),
      var keyB = b.title; //new Date(b.date);
      return (keyA < keyB) ? -1 : ((keyA > keyB) ? 1 : 0);
    });

    return parsed;
  }

  function getContacts(win, cb) {
    var t = (ginst || {}).accessToken;
    if ( !ginst || !t ) {
      cb('Google API instance was not created or invalid token!');
      return;
    }

    win._toggleLoading(true);

    Promise.resolve(jsonp('GET', 'https://www.google.com/m8/feeds/contacts/default/full', {
      qs: {
        alt: 'json',
        access_token: t,
        'max-results': 700,
        v: '3.0'
      }
    })).then((data) => {
      return cb(false, parseContacts(data));
    }).catch((err) => {
      cb('Failed to fetch contacts from google: ' + err);
    }).finally(() => {
      win._toggleLoading(false);
    });
  }

  return function(win, callback) {
    win._toggleLoading(true);

    connect(function(error) {
      if ( error ) {
        callback(error);
        return;
      }

      getContacts(win, function(error, result) {
        callback(error, result);
      });
    });
  };
})();

class ApplicationGoogleContactsWindow extends Window {
  constructor(app, metadata) {
    super('ApplicationGoogleContactsWindow', {
      icon: metadata.icon,
      title: metadata.name,
      width: 400,
      height: 200
    }, app);
  }

  init(wmRef, app) {
    var root = super.init(...arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    this._render('ApplicationGoogleContactsWindow', require('osjs-scheme-loader!scheme.html'));

    this._find('View').on('activate', function(ev) {
      self.activateContact(ev.detail.entries[0].data);
    });
    this._find('SubmenuFile').on('select', function(ev) {
      if ( ev.detail.id === 'MenuRefresh' ) {
        app.sync();
      } else if ( ev.detail.id === 'MenuClose' ) {
        self._close();
      }
    });

    return root;
  }

  renderGoogleContacts(contacts) {
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

    var view = this._find('View');
    view.clear().add(rows);
  }

  editContact(contact) {
    if ( !contact ) {
      return;
    }
    console.debug('editContact', contact);
  }

  deleteContact(contact) {
    if ( !contact ) {
      return;
    }
    console.debug('deleteContact', contact);
  }

  createContact() {
    console.debug('createContact');
  }

  activateContact(contact) {
    if ( !contact && !contact.emails.length ) {
      return;
    }

    console.debug('activateContact', contact);

    Application.create('ApplicationGmail', {
      action: 'create',
      title: contact.title,
      email: contact.emails[0]
    });
  }

  getSelectedContact() {
    var view = this.contactView;
    if ( view ) {
      return view.getSelected();
    }

    return false;
  }
}

class ApplicationGoogleContacts extends Application {

  constructor(args, metadata) {
    super('ApplicationGoogleContacts', args, metadata);
  }

  init(settings, metadata) {
    super.init(...arguments);

    this._addWindow(new ApplicationGoogleContactsWindow(this, metadata));
    this.sync();
  }

  sync() {
    var mainWindow = this.__windows[0];

    pullContacts(mainWindow, function(error, result) {
      if ( error ) {
        OSjs.error('Google Calendar Error', 'An error occured while getting contacts', error);
      }

      if ( mainWindow ) {
        if ( result ) {
          mainWindow.renderGoogleContacts(result);
        }
      }
    });
  }
}

OSjs.Applications.ApplicationGoogleContacts = ApplicationGoogleContacts;

