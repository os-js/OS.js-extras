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
const FS = OSjs.require('utils/fs');
const Utils = OSjs.require('utils/misc');
const GoogleAPI = OSjs.require('helpers/google-api');
const Notification = OSjs.require('gui/notification');
const PackageManager = OSjs.require('core/package-manager');

var ENABLE_NOTIFICATIONS = false;

var MAX_PAGES = 10;

//var INTERVAL_FOLDER    = (30 * 1000);
//var INTERVAL_MESSAGES  = (30 * 1000);
var CONNECTION_TIMEOUT = 600 * 1000;

var STATE_EMPTY   = 0;
var STATE_CREATED = 1;
var STATE_UNREAD  = 2;
var STATE_STARRED = 4;
var STATE_TRASHED = 8;

/*
 * https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
 * https://developers.google.com/gmail/api/v1/reference/users/messages/list
 * https://developers.google.com/gmail/api/v1/reference/users/labels
 *
 * TODO:
 * - Clean up events
 * - Check if sync is required
 * - Option to pull messages every X seconds (60 minimum)
 * - Create HTML Mail
 * - Send Attachments
 * - Settings/Options
 * - Trashing support
 * - Drafting support
 * - Searching
 * - Nested folder view
 * - Better error handling and display
 * - Folder Cache (just as with messages)
 */

var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
//var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
//var IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
var gapi = window.gapi || {};

/////////////////////////////////////////////////////////////////////////////
// MESSAGE STORAGE
/////////////////////////////////////////////////////////////////////////////

function GoogleMailStorage(callback) {
  this.db = null;
  this.lastMessage = null;

  var self = this;

  function done(ev) {
    self.db = ev.target.result;
    callback(false, true, self);
  }

  function create(ev) {
    var db = ev.target.result;

    try {
      db.deleteObjectStore('messages');
    } catch ( e ) {}

    var objectStore = db.createObjectStore('messages', {keyPath: 'id'});
    objectStore.createIndex('sender', 'sender', {unique: false});
    objectStore.createIndex('subject', 'subject', {unique: false});
    objectStore.createIndex('date', 'date', {unique: false});
    objectStore.createIndex('threadId', 'threadId', {unique: false});
    objectStore.createIndex('state', 'state', {unique: false});
    objectStore.createIndex('attachments', 'attachments', {unique: false});

    objectStore.transaction.oncomplete = function(evt) {
      done(ev);
    };
    objectStore.transaction.onerror = function(evt) {
      //console.warn("ERROR", evt);
    };
  }

  console.log('GoogleMailStorage::construct()');

  var request = indexedDB.open('GoogleMailStorage', 1);
  request.onerror = function(ev) {
    callback(ev.target.error.message, false, self);
  };
  request.onsuccess = function(ev) {
    done(ev);
  };
  request.onupgradeneeded = function(ev) {
    create(ev);
  };
}

GoogleMailStorage.prototype.addMessage = function(args, callback, put) {
  if ( !this.db ) {
    callback('No database connection');
    return;
  }

  //console.debug('GoogleMailStorage::addMessage()', args);

  var store = this.db.transaction('messages', 'readwrite').objectStore('messages');
  var request = store[put ? 'put' : 'add'](args);
  request.onsuccess = function(ev) {
    callback(false, ev.result || true);
  };
  request.onerror = function(ev) {
    callback(ev.target.error.message, false);
  };
};

GoogleMailStorage.prototype.getMessage = function(id, callback) {
  if ( !this.db ) {
    callback('No database connection');
    return;
  }

  //console.debug('GoogleMailStorage::getMessage()', id);

  var transaction = this.db.transaction(['messages'], 'readwrite');
  var objectStore = transaction.objectStore('messages');
  var request = objectStore.get(id);

  request.onsuccess = function(ev) {
    callback(false, ev.target.result || null, objectStore);
  };
  request.onerror = function(ev) {
    callback(ev.target.error.message, false);
  };
};

GoogleMailStorage.prototype.removeMessage = function(id, callback) {
  if ( !this.db ) {
    callback('No database connection');
    return;
  }

  var request = this.db.transaction(['messages'], 'readwrite')
    .objectStore('messages')
    .delete(id);

  request.onsuccess = function(ev) {
    callback(false, ev.result || true);
  };
  request.onerror = function(ev) {
    callback(ev.target.error.message, false);
  };
};

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

function checkIfInternal(name) {
  return name.match(/^(\[Imap\]|CATEGORY_|CHAT|DRAFT|UNREAD|INBOX|TRASH|IMPORTANT|STARRED|SPAM|SENT)/);
}

function createInboxNotification(folder, unreadCount) {
  if ( !folder || !unreadCount ) {
    return;
  }

  Notification.create({
    icon: PackageManager.getPackageResource('ApplicationGmail', './icon.png'),
    title: 'Google Mail',
    message: Utils.format('{0} has {1} unread message(s)', folder, unreadCount)
  });
}

/**
 * Check if required argumets is set
 */
function checkArguments(args, check, cb) {
  var result = true;

  check.forEach(function(c) {
    if ( result === false ) {
      return false;
    }

    if ( !args[c] ) {
      result = false;
      cb('You have to specify argument: ' + c);
    }

    return true;
  });

  return result;
}

/**
 * Parses a Folder response
 */
function parseFolderResponse(resp) {
  var folders = [];
  (resp.labels || []).forEach(function(i) {
    folders.push({
      name: i.name,
      id: i.id
    });
  });
  return folders;
}

/**
 * Parses a Message raw response
 */
function parseMessageDataResponse(messageId, payload) {
  var parsed = {
    raw: '',
    text: [],
    html: [],
    attachments: []
  };

  function parse(load) {

    if ( load.body ) {
      if ( load.filename ) {
        parsed.attachments.push({
          mime: load.mimeType,
          size: load.body.size,
          filename: load.filename,
          messageId: messageId,
          id: load.body.attachmentId
        });
      }

      var data = '';
      if ( load.mimeType.match(/^text/) ) {
        data = FS.atobUrlsafe(load.body.data);
        if ( load.mimeType.match(/^text\/html/) ) {
          parsed.text.push(data);
        } else {
          parsed.html.push(data);
        }
      }

      parsed.raw += data;
    }

    if ( load.parts ) {
      load.parts.forEach(function(part) {
        parse(part);
      });
    }
  }

  parse(payload);

  return parsed;
}

/**
 * Parses a Message metadata response
 */
function parseMessageResponse(resp) {
  var data = {
    id: resp.id,
    subject: resp.snippet,
    state: STATE_CREATED
  };

  if ( resp.labelIds ) {
    if ( resp.labelIds.indexOf('UNREAD') !== -1 ) {
      data.state |= STATE_UNREAD;
    }
    if ( resp.labelIds.indexOf('STARRED') !== -1 ) {
      data.state |= STATE_STARRED;
    }
    if ( resp.labelIds.indexOf('TRASH') !== -1 ) {
      data.state |= STATE_STARRED;
    }
  }

  if ( resp.payload && resp.payload.headers ) {
    resp.payload.headers.forEach(function(header) {
      var name = header.name.toLowerCase();
      var map = {from: 'sender'};
      if ( ['from', 'date', 'subject'].indexOf(name) !== -1 ) {
        data[map[name] || name] = header.value;
      }
    });
  }

  return data;
}

/**
 * Parses a Page response
 */
function parsePageResponse(resp) {
  var messages = [];
  (resp.messages || []).forEach(function(i) {
    messages.push({
      id: i.id,
      threadId: i.threadId,
      sender: null,
      subject: null,
      date: null,
      state: 0
    });
  });
  return messages;
}

/**
 * Generates the raw data required to send a message
 */
function generateRawData(user, to, subject, message) {
  var from = '"' + user.name + '" <' + user.email + '>';
  var lines = [];
  lines.push('From: ' + from);
  lines.push('To: ' + to);
  lines.push('Content-type: text/html;charset=iso8859-1');
  lines.push('MIME-Version: 1.0');
  lines.push('Subject: ' + subject);
  lines.push('');
  lines.push(message);

  var raw = lines.join('\r\n');
  return FS.btoaUrlsafe(raw);
}

/////////////////////////////////////////////////////////////////////////////
// MAILER
/////////////////////////////////////////////////////////////////////////////

export class GoogleMail {
  constructor(args, cb) {
    var self = this;

    //console.clear();
    console.group('GoogleMail::construct()');

    this.destroy();

    this.args = Object.assign({
      maxPages: MAX_PAGES,
      onAbortStart: function() {},
      onAbortEnd: function() {}
    }, args || {});

    if ( args.maxPages > MAX_PAGES ) {
      args.maxPages = MAX_PAGES;
    }

    console.debug('Arguments', this.args);

    this.storage = new GoogleMailStorage(function() {
      self._connect(function() {
        console.debug('GoogleMail was inited');
        console.groupEnd();

        cb();
      });
    });
  }

  destroy() {
    this.args = {};
    this.busy = false;
    this.aborting = false;
    this.ginst = null;

    this.folderCache = [];
    this.lastFolderId = null;
    this.lastConnection = null;
    this.lastFolderSync = null;
    this.lastMessageSync = {};

    this.user = {
      id: null,
      name: 'osjs',
      email: 'osjs@osjs'
    };
  }

  /**
   * Loads and initializes the Google API
   */
  _connect(cb) {
    if ( this.lastConnection ) {
      var now = new Date();
      if ( now - this.lastConnection < CONNECTION_TIMEOUT ) {
        this.lastConnection = now;

        cb(false, true);
        return;
      }
    }

    var self = this;
    var load = [['gmail', 'v1']];
    var scope = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/plus.profile.emails.read',
      'https://mail.google.com',
      'openid'
    ];

    console.log('GoogleMail::_connect()');

    GoogleAPI.create({load: load, scope: scope, client: true}, function(error, result, inst) {
      if ( !inst ) {
        cb('Failed to load Google API');
        return;
      }

      gapi = window.gapi || {};

      self.ginst = inst;
      self.lastConnection = new Date();

      self._getUserInfo(function(err, user) {
        if ( user ) {
          self.user = user;
        }
        cb(err, true);
      });
    });
  }

  /**
   * Pull user information about used account
   */
  _getUserInfo(cb) {
    console.log('GoogleMail::_getUserInfo()');

    if ( this.user.id !== null ) {
      cb(false, false);
      return;
    }

    function parseUser(resp) {
      if ( resp ) {
        var user = {};

        if ( resp.emails ) {
          resp.emails.forEach(function(i) {
            if ( i.type === 'account' ) {
              user.email = i.value;
              return false;
            }
            return true;
          });
        }

        user.id     = resp.id;
        user.name   = resp.displayName;

        return user;
      }
      return null;
    }

    gapi.client.load('plus', 'v1', function() {
      gapi.client.plus.people.get({
        userId: 'me'
      }).execute(function(resp) {
        var user = parseUser(resp);
        console.debug('GoogleMail::_getUserInfo()', '=>', user);

        cb(user ? false : 'Failed to fetch user information.', user);
      });
    });
  }

  /**
   * Check if connection is established etc.
   */
  _checkConnection(cb) {
    cb = cb || function() {};
    if ( !this.ginst ) {
      cb('No Google API instance');
      return false;
    }
    if ( !this.storage ) {
      cb('No Google Mail storage instance');
      return false;
    }
    return true;
  }

  //
  // FOLDERS
  //

  /**
   * Gets all folders
   */
  getFolders(args, cb) {
    cb = cb || function() {};
    if ( !this._checkConnection(cb) ) {
      return;
    }

    var self = this;
    args = Object.assign({
      cache: false,
      onStart: function() {},
      onEnd: function() {}
    }, args);

    console.log('GoogleMail::getFolders()', args);

    if ( args.cache ) {
      cb(false, this.folderCache);
      return;
    }

    /*
    var now = new Date();
    if ( this.lastFolderSync && (now - this.lastFolderSync) < INTERVAL_FOLDER ) {
      console.warn('GoogleMail::getFolders() aborted due to timeout');
      cb('You have to wait ' + INTERVAL_FOLDER/1000 + ' seconds between folder sync');
      return;
    }
    */

    args.onStart();

    this._connect(function(error) {
      if ( error ) {
        args.onEnd();
        cb(error);
        return;
      }

      var request = gapi.client.gmail.users.labels.list({
        userId: 'me'
      });

      request.execute(function(resp) {
        var folders = parseFolderResponse(resp);
        self.folderCache = folders;
        args.onEnd();

        cb(false, folders);

        self.lastFolderSync = new Date();
      });
    });
  }

  /**
   * Creates a folder
   */
  createFolder(args, cb) {
    cb = cb || function() {};
    if ( !this._checkConnection(cb) ) {
      return;
    }
    args = Object.assign({
      name: null
    }, args);

    console.log('GoogleMail::createFolder()', args);
    if ( !checkArguments(args, ['name'], cb) ) {
      return;
    }
    if ( checkIfInternal(args.name) ) {
      cb('Invalid folder name');
      return;
    }

    var request = gapi.client.gmail.users.labels.create({
      userId: 'me',
      name: args.name
    });

    request.execute(function(resp) {
      var error = !resp || !resp.result ? 'Failed to rename folder' : false;
      cb(error, !!error);
    });
  }

  /**
   * Renames a folder
   */
  renameFolder(args, cb) {
    cb = cb || function() {};
    if ( !this._checkConnection(cb) ) {
      return;
    }
    args = Object.assign({
      id: null,
      name: null
    }, args);

    console.log('GoogleMail::renameFolder()', args);
    if ( !checkArguments(args, ['id', 'name'], cb) ) {
      return;
    }
    if ( checkIfInternal(args.name) ) {
      cb('Invalid folder name');
      return;
    }

    var request = gapi.client.gmail.users.labels.patch({
      userId: 'me',
      id: args.id,
      name: args.name
    });

    request.execute(function(resp) {
      var error = !resp || !resp.result ? 'Failed to rename folder' : false;
      cb(error, !!error);
    });
  }

  /**
   * Removes a folder
   */
  removeFolder(args, cb) {
    cb = cb || function() {};
    if ( !this._checkConnection(cb) ) {
      return;
    }
    args = Object.assign({
      id: null
    }, args);

    console.log('GoogleMail::removeFolder()', args);
    if ( !checkArguments(args, ['id'], cb) ) {
      return;
    }

    if ( checkIfInternal(args.id) ) {
      cb('Invalid folder name');
      return;
    }

    var request = gapi.client.gmail.users.labels['delete']({
      userId: 'me',
      id: args.id
    });

    request.execute(function(resp) {
      cb(resp ? 'Failed to delete folder' : false, !resp);
    });
  }

  /**
   * Gets a folders information
   */
  _getFolder(args, cb) {
    cb = cb || function() {};
    if ( !this._checkConnection(cb) ) {
      return;
    }
    args = Object.assign({
      id: null
    }, args);

    console.log('GoogleMail::_getFolder()', args);
    if ( !checkArguments(args, ['id'], cb) ) {
      return;
    }

    var request = gapi.client.gmail.users.labels.get({
      userId: 'me',
      id: args.id
    });

    request.execute(function(resp) {
      var data = resp && resp.result ? resp.result : null;
      console.log('GoogleMail::_getFolder()', '=>', data);
      cb(data ? false : 'Failed to get folder', data);
    });
  }

  //
  // ATTACHMENTS
  //

  /**
   * Get a Message Attachment
   */
  downloadAttachment(args, cb) {
    cb = cb || function() {};
    function _download(data) {
      var blob = new Blob([data], {type: args.mime});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', args.filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    args = Object.assign({
      id: null,
      mime: null,
      filename: null,
      attachmentId: null
    }, args);

    console.log('GoogleMail::attachment()', args);
    if ( !checkArguments(args, ['id', 'mime', 'filename', 'attachmentId'], cb) ) {
      return;
    }

    var request = gapi.client.gmail.users.messages.attachments.get({
      'userId': 'me',
      'messageId': args.id,
      'id': args.attachmentId
    });

    request.execute(function(resp) {
      if ( resp.data ) {
        _download(FS.atobUrlsafe(resp.data));

        cb(false, true);
        return;
      }

      cb('Failed to fetch attachment');
    });
  }

  //
  // MESSAGES
  //

  /**
   * Gets all messages in a folder
   */
  getMessages(args, callback) {
    callback = callback || function() {};
    var self = this;

    if ( !this._checkConnection(callback) ) {
      return;
    }

    args = Object.assign({
      force: false,
      folder: null,
      onPageAdvance: function() {},
      onMessageQueue: function() {},
      onStart: function() {},
      onEnd: function() {}
    }, args);

    if ( this.aborting ) {
      console.warn('I AM BUSY ABORTING. YOU SHOULD MAKE YOUR UI DISABLE WHEN THIS HAPPENS');
      callback('Cannot perform this opertaion');
      return;
    }

    var aborted = false;
    var refresh = this.lastFolderId && this.lastFolderId === args.folder;

    function resumeNext() {
      if ( aborted ) {
        return;
      }

      aborted = true;
      self.args.onAbortEnd();

      self.busy = false;
      self.aborting = false;
      self.getMessages(args, callback);
    }

    if ( this.busy ) {
      console.warn('Looks like GoogleMail is busy... I have to abort and reschedule');
      this.args.onAbortStart();

      this.aborting = function() {
        //self.busy = false;

        if ( !self.aborting ) {
          resumeNext();
        } else {
          var tmp = setInterval(function() {
            if ( !self.aborting ) {
              clearInterval(tmp);
              resumeNext();
            }
          }, 100);
        }
      };

      callback('Delaying action...');
      return;
    }

    function cb(err, messageList) {
      console.groupEnd();

      if ( ENABLE_NOTIFICATIONS && !self.aborting && !err && messageList ) {
        var unreadCount = 0;
        messageList.forEach(function(m) {
          if ( m && m.state & STATE_UNREAD ) {
            unreadCount++;
          }
        });
        createInboxNotification(args.folder, unreadCount);
      }

      args.onEnd();
      callback.apply(null, arguments);
    }

    console.group('GoogleMail::getMessages()', args);
    if ( !checkArguments(args, ['folder'], cb) ) {
      return;
    }

    /*
    var now = new Date();
    if ( this.lastMessageSync[args.folder] && (now - this.lastMessageSync[args.folder]) < INTERVAL_MESSAGES ) {
      console.log('GoogleMail::getMessages()', args);
      console.warn('GoogleMail::getMessages() aborted due to timeout');
      callback('You have to wait ' + INTERVAL_MESSAGES/1000 + ' seconds between folder sync');
      return;
    }
    */

    var maxPages = this.args.maxPages;
    var pageCurrent = 0;
    var pagesTotal = 0;
    var messagesCaught = 0;
    var messagesTotal = 0;
    var resultList = [];

    function checkAbortion(done) {
      if ( self.aborting ) {
        self.aborting();

        done('Cancelled due to abortion...');
        return true;
      }
      return false;
    }

    function runMessageQueue(queue, nextPage, finished) {
      var current = 0;
      var messages = [];

      function _next() {
        if ( checkAbortion(finished) ) {
          return;
        }

        if ( current >= queue.length ) {
          finished(false, messages, nextPage);
          return;
        }

        args.onMessageQueue({
          refresh: refresh,
          force: args.force,
          pageCurrent: pageCurrent + 1,
          pagesTotal: pagesTotal,
          messageIndex: current,
          messageCurrent: messagesCaught,
          messagesTotal: messagesTotal,
          folder: args.folder
        });

        self._getMessage(queue[current], function(error, result, fromCache) {
          if ( checkAbortion(finished) ) {
            return;
          }

          //console.debug('  =', fromCache);
          messagesCaught++;

          if ( result ) {
            messages.push(result);
          }
          _next();
        }, args.force);

        current++;
      }

      _next();
    }

    function fetchPage(folder, nextPage, done) {
      function fetchPageMessages(folderId, pcb) {
        var rargs = {
          userId: 'me',
          labelIds: folderId
        };

        if ( nextPage ) {
          rargs.pageToken = nextPage;
        }

        var request = gapi.client.gmail.users.messages.list(rargs);
        request.execute(function(resp) {
          pcb(false, {
            queue: parsePageResponse(resp),
            nextPageToken: resp.nextPageToken
          });
        });
      }

      if ( nextPage ) {
        pageCurrent++;
      }

      if ( maxPages > 0 && pageCurrent >= maxPages ) {
        console.warn('fetchPage()', 'We hit the limit, sir', pageCurrent, maxPages);
        done(false);
        return;
      }

      console.debug('GoogleMail::getMessages()->fetchPage()', nextPage, pageCurrent);

      args.onPageAdvance({
        refresh: refresh,
        force: args.force,
        pageCurrent: pageCurrent + 1,
        pagesTotal: pagesTotal,
        messageCurrent: messagesCaught,
        messagesTotal: messagesTotal,
        messages: resultList
      });

      if ( checkAbortion(done) ) {
        return;
      }

      fetchPageMessages(args.folder, function(err, result) {
        if ( checkAbortion(done) ) {
          return;
        }

        runMessageQueue(result.queue, result.nextPageToken, function(error, messages, nextPage) {
          if ( checkAbortion(done) ) {
            return;
          }

          if ( messages ) {
            resultList = resultList.concat(messages);
          }

          if ( nextPage ) {
            console.debug('...advancing to next page...', nextPage);
            fetchPage(folder, nextPage, done);
            return;
          }

          done(error);
        });
      });
    }

    this.busy = true;
    this.aborting = false;
    this.lastFolderId = args.folder;
    args.onStart();

    this._connect(function(error) {
      if ( error ) {
        cb(error);
        return;
      }

      self._getFolder({id: args.folder}, function(error, folder) {
        if ( checkAbortion(cb) ) {
          return;
        }

        if ( !folder ) {
          cb('Cannot get messages: ' + error);
          return;
        }

        messagesTotal = folder.messagesTotal || 0;
        pagesTotal = Math.ceil(messagesTotal / 100);
        if ( maxPages > 0 && pagesTotal > maxPages ) {
          pagesTotal = maxPages;
          messagesTotal = maxPages * 100;
        }

        fetchPage(folder, null, function(error) {
          self.lastMessageSync[args.folder] = new Date();
          self.busy = false;
          self.aborting = false;

          console.log('Finished getting messages. %d in total', resultList.length);

          cb(false, resultList);
        });
      });
    });
  }

  /**
   * Gets a message (either from cache or google)
   */
  _getMessage(args, cb, forceFetch) {
    cb = cb || function() {};

    args = Object.assign({
      id: null
    }, args);

    //console.group('GoogleMail::_getMessage()', args);

    if ( this.aborting ) {
      cb('Cancelled due to abortion...');
      return;
    }

    if ( !checkArguments(args, ['id'], cb) ) {
      return;
    }

    var self = this;
    function fetch(fetched) {
      var request = gapi.client.gmail.users.messages.get({
        userId: 'me',
        id: args.id,
        format: 'metadata'
      });

      request.execute(function(resp) {
        fetched(false, parseMessageResponse(resp));
      });
    }

    function finished() {
      //console.groupEnd();
      cb.apply(null, arguments);
    }

    this.storage.getMessage(args.id, function(err, res) {
      var fromCache = !err && res;
      if ( forceFetch || !fromCache ) {
        console.debug('GoogleMail::_getMessage()', 'Message was not found in cache, downloading');

        fetch(function(error, message) {
          if ( error ) {
            console.warn('Failed to fetch message from google', error);

            finished('Failed to fetch message from google');
            return;
          }

          self.storage.addMessage(message, function(serr, sres) {
            /*
            if ( serr ) {
              console.warn('Failed to add message to cache', serr);
            }
            */
            finished(serr, message, fromCache);
          }, forceFetch ? true : false);
        });
        return;
      }

      finished(res ? false : 'Failed to fetch message from cache', res, fromCache);
    });
  }

  /**
   * Send a Message
   */
  sendMessage(args, cb) {
    cb = cb || function() {};
    var self = this;

    args = Object.assign({
      to: null,
      subject: null,
      message: null
    }, args);

    console.log('GoogleMail::send()', args);
    if ( !checkArguments(args, ['to', 'subject', 'message'], cb) ) {
      return;
    }

    var request = gapi.client.gmail.users.messages.send({
      userId: 'me',
      raw: generateRawData(self.user, args.to, args.subject, args.message)
    });

    request.execute(function(resp) {
      var result = resp && resp.id ? resp : false;
      cb(!result ? 'Failed to send' : false, result);
    });
  }

  /**
   * Mark a message
   */
  markMessage(args, cb) {
    var self = this;
    cb = cb || function() {};

    args = Object.assign({
      markAs: null,
      id: null
    }, args);

    console.log('GoogleMail::mark()', args);
    if ( !checkArguments(args, ['id', 'markAs'], cb) ) {
      return;
    }

    var rargs = {
      userId: 'me',
      id: args.id
    };

    if ( args.markAs === 'read' ) {
      rargs.removeLabelIds = ['UNREAD'];
    } else if ( args.markAs === 'unread' ) {
      rargs.addLabelIds = ['UNREAD'];
    } else if ( args.markAs === 'starred' ) {
      rargs.addLabelIds = ['STARRED'];
    } else if ( args.markAs === 'unstar' ) {
      rargs.removeLabelIds = ['STARRED'];
    }

    var request = gapi.client.gmail.users.messages.modify(rargs);
    request.execute(function(resp) {
      if ( !resp || !resp.result ) {
        cb(false, true);
        return;
      }

      self.storage.getMessage(args.id, function(err, msg) {
        if ( err || !msg ) {
          cb(false, true, args.id);
          return;
        }

        if ( args.markAs === 'read' ) {
          if ( msg.state & STATE_UNREAD ) {
            msg.state = msg.state ^ STATE_UNREAD;
          }
        } else if ( args.markAs === 'unread' ) {
          if ( !(msg.state & STATE_UNREAD) ) {
            msg.state = msg.state | STATE_UNREAD;
          }
        } else if ( args.markAs === 'starred' ) {
          if ( !(msg.state & STATE_STARRED) ) {
            msg.state = msg.state | STATE_STARRED;
          }
        } else if ( args.markAs === 'unstar' ) {
          if ( msg.state & STATE_STARRED ) {
            msg.state = msg.state ^ STATE_STARRED;
          }
        }

        self.storage.addMessage(msg, function(err) {
          cb(err, true, args.id, msg.state);
        }, true);
      });
    });
  }

  /**
   * Recieve a Message
   */
  recieveMessage(args, cb) {
    var self = this;
    cb = cb || function() {};
    args = Object.assign({
      id: null,
      returnFull: false,
      markRead: false
    }, args);

    console.log('GoogleMail::recieve()', args);
    if ( !checkArguments(args, ['id'], cb) ) {
      return;
    }

    var request = gapi.client.gmail.users.messages.get({
      userId: 'me',
      id: args.id
    });

    request.execute(function(resp) {
      var message = parseMessageDataResponse(args.id, resp.payload);
      if ( args.returnFull ) {
        message = {
          message: message,
          data: parseMessageResponse(resp)
        };
      }

      if ( args.markRead ) {
        args = {id: args.id, markAs: 'read'};
        self.markMessage(args, function() {
          cb(message ? false : 'Failed to fetch message data', message);
        });
      } else {
        cb(message ? false : 'Failed to fetch message data', message);
      }
    });
  }

  /**
   * Move a Message
   */
  moveMessage(args, cb) {
    cb = cb || function() {};
    args = Object.assign({
      id: null,
      from: null,
      to: null
    }, args);

    console.log('GoogleMail::move()', args);
    if ( !checkArguments(args, ['id', 'from', 'to'], cb) ) {
      return;
    }

    if ( this.busy || this.aborting ) {
      console.warn('Cannot perform this operation while busy or aborting');
      cb('Cannot perform this operation while busy or aborting');
      return;
    }

    var request = gapi.client.gmail.users.messages.modify({
      userId: 'me',
      id: args.id,
      addLabelIds: [args.to],
      removeLabelIds: [args.from]
    });

    request.execute(function(resp) {
      if ( !resp || !resp.result ) {
        console.warn('Failed to move google message');
        cb('Failed to move google message');
        return;
      }
      cb(false, true);
    });
  }

  /**
   * Delete a Message
   */
  removeMessage(args, cb) {
    var self = this;

    cb = cb || function() {};
    args = Object.assign({
      id: null
    }, args);

    console.log('GoogleMail::remove()', args);
    if ( !checkArguments(args, ['id'], cb) ) {
      return;
    }

    if ( this.busy || this.aborting ) {
      console.warn('Cannot perform this operation while busy or aborting');
      cb('Cannot perform this operation while busy or aborting');
      return;
    }

    var request = gapi.client.gmail.users.messages.delete({
      userId: 'me',
      id: args.id
    });

    request.execute(function(resp) {
      var error = !resp || Object.keys(resp).length > 0;
      if ( !error ) {
        self.storage.removeMessage(args.id, function(err, result) {
          if ( err ) {
            console.warn('Failed to remove cached message', err);
            cb('Failed to remove cached message: ' + err);
            return;
          }
          cb(false, true);
        });
        return;
      }

      console.warn('Failed to delete google message');
      cb('Failed to delete google message');
    });
  }

  setMaxPages(p) {
    this.args.maxPages = parseInt(p, 10) || MAX_PAGES;
  }
}

export const MessageStates = {
  EMPTY: STATE_EMPTY,
  CREATED: STATE_CREATED,
  UNREAD: STATE_UNREAD,
  STARRED: STATE_STARRED,
  TRASHED: STATE_TRASHED
};

