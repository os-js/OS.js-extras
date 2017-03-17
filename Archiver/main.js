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
(function(DefaultApplication, DefaultApplicationWindow, Application, Window, Utils, API, VFS, GUI) {
  'use strict';

  function filterListing(entries, path) {
    if ( path.substr(0, 1) !== '/' ) {
      path = '/' + path;
    }
    if ( path != '/' ) {
      path = path.replace(/\/$/, '');
    }

    var result = [];
    (entries || []).forEach(function(e) {
      var p = '/' + e.filename;
      if ( Utils.dirname(p) === path ) {
        result.push(e);
      }
    });


    result.sort(function(a, b) {
      if (a.directory < b.directory) {
        return 1;
      }
      if (a.directory > b.directory) {
        return -1;
      }
      return 0;
    });

    return result;
  }

  var getMime = (function() {
    var mimes = API.getConfig('MIME.mapping') || {};

    return function(e) {
      if ( e.directory ) {
        return '';
      }

      var ext = '.' + Utils.filext(e.filename);
      return mimes[ext] || 'application/octet-stream';
    };
  })();

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  function ApplicationArchiverWindow(app, metadata, scheme, file) {
    DefaultApplicationWindow.apply(this, ['ApplicationArchiverWindow', {
      allow_drop: true,
      icon: metadata.icon,
      title: metadata.name,
      width: 450,
      height: 300
    }, app, scheme, file]);
  }

  ApplicationArchiverWindow.prototype = Object.create(DefaultApplicationWindow.prototype);
  ApplicationArchiverWindow.constructor = DefaultApplicationWindow.prototype;

  ApplicationArchiverWindow.prototype.init = function(wmRef, app, scheme) {
    var root = DefaultApplicationWindow.prototype.init.apply(this, arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    this._render('ArchiverWindow');

    function getSelectedEntry() {
      var sel = self._find('FileView').get('selected');
      if ( sel && sel.length ) {
        return sel[0].data.filename;
      }
      return null;
    }

    this._find('MenuBar').on('select', function(ev) {
      if ( ev.detail.id === 'MenuExtract' ) {
        app.action('extract');
      } else if ( ev.detail.id === 'MenuRemove' ) {
        app.action('remove', getSelectedEntry());
      } else if ( ev.detail.id === 'MenuAddFile' ) {
        app.action('add', null);
      } else if ( ev.detail.id === 'MenuAddDirectory' ) {
        app.action('add', 'dir');
      }
    });

    /*
    this._find('FileView').on('select', function(ev) {
      var selected = ev.detail.entries[0].data;
    });
    */

    this._find('FileView').on('activate', function(ev) {
      var selected = ev.detail.entries[0].data;
      if ( selected.directory ) {
        app.action('chdir', '/' + selected.filename);
      }
    });

    this.renderProgress(false);

    return root;
  };

  ApplicationArchiverWindow.prototype.updateFile = function(file) {
    DefaultApplicationWindow.prototype.updateFile.apply(this, arguments);
  };

  ApplicationArchiverWindow.prototype.showFile = function(file, content) {
    DefaultApplicationWindow.prototype.showFile.apply(this, arguments);
    this._app.action('open', file);
  };

  ApplicationArchiverWindow.prototype.getFileData = function() {
    return null;
  };

  ApplicationArchiverWindow.prototype.renderProgress = function(filename, index, total) {
    if ( !this._scheme ) {
      return;
    }

    var p = this._find('Progress');
    var s = this._find('Statusbar');

    if ( p && s ) {
      if ( filename === true || filename === false ) {
        p.hide().set('value', 0);
        s.set('value', '');
      } else {
        p.show().set('value', Math.round((index / total) * 100));
        s.set('value', 'Extracting: ' + filename);
      }
    }
  };

  ApplicationArchiverWindow.prototype.renderArchive = function(entries, root) {
    if ( !this._scheme ) {
      return;
    }

    var view = this._find('FileView');
    var rows = [];

    if ( root !== '/' ) {
      rows.push({
        value: {
          directory: true,
          filename: (Utils.dirname(root) || '/').replace(/^\//, '')
        },
        columns: [
          {label: '..'},
          {label: '', textalign: 'right'},
          {label: 0, textalign: 'right'}
        ]
      });
    }

    if ( entries ) {
      filterListing(entries, root).forEach(function(e) {
        var filename = Utils.filename(e.filename.replace(/\/$/, ''));

        var fiter = {
          type: e.directory ? 'dir' : 'file',
          filename: filename,
          path: Utils.dirname(e.filename.replace(/\/$/, '')),
          mime: e.directory ? null : getMime(e)
        };

        rows.push({
          value: e,
          columns: [
            {label: Utils.filename(e.filename), icon: API.getFileIcon(fiter)},
            {label: getMime(e), textalign: 'right'},
            {label: Utils.humanFileSize(e.uncompressedSize), textalign: 'right'}
          ]
        });
      });

      view.set('columns', [
        {label: 'Name', size: '100px'},
        {label: 'Type', size: '100px', textalign: 'right'},
        {label: 'Size', size: '60px', textalign: 'right'}
      ]);
    }

    view.clear();
    view.add(rows);
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  var ApplicationArchiver = function(args, metadata) {
    DefaultApplication.apply(this, ['ApplicationArchiver', args, metadata, {
      readData: false,
      extension: 'zip',
      mime: 'application/zip',
      filename: 'New archive.zip'
    }]);

    this.currentArchive = null;
    this.currentPath = '/';
  };

  ApplicationArchiver.prototype = Object.create(DefaultApplication.prototype);
  ApplicationArchiver.constructor = DefaultApplication;

  ApplicationArchiver.prototype.destroy = function() {
    this.currentArchive = null;
    this.currentPath = '/';

    return DefaultApplication.prototype.destroy.apply(this, arguments);
  };

  ApplicationArchiver.prototype.init = function(settings, metadata, scheme) {
    Application.prototype.init.call(this, settings, metadata, scheme);

    var file = this._getArgument('file');
    this._addWindow(new ApplicationArchiverWindow(this, metadata, scheme, file));
  };

  ApplicationArchiver.prototype.action = function(action, arg, arg2) {
    var self = this;
    var win = this._getMainWindow();
    var file = this.currentArchive;

    win._toggleLoading(true);
    OSjs.Helpers.ZipArchiver.createInstance({}, function(err, inst) {
      win._toggleLoading(false);

      if ( err ) {
        API.createDialog('Error', {
          title: 'Archiver error',
          message: 'Cannot perform action',
          error: 'No zip support: ' + err
        }, function() {}, win);
        return;
      }

      if ( action === 'add' ) {
        self.openAddDialog(file, arg, function(result) {
          if ( result ) {
            inst.add(file, result, {
              path: self.currentPath,
              oncomplete: function() {
                win._toggleLoading(false);

                self.action('open', file, self.currentPath);
              }
            });
          } else {
            win._toggleLoading(false);
          }
        });
      } else if ( action === 'extract' ) {
        win._toggleLoading(true);

        self.openExtractDialog(file, function(result) {
          if ( result ) {
            inst.extract(file, result.path, {
              oncomplete: function() {
                if ( win ) {
                  win._toggleLoading(false);
                  win.renderProgress(false);
                }
              },
              onprogress: function(filename, idx, total) {
                if ( win ) {
                  win.renderProgress(filename, idx, total);
                }
              },
              app: self
            });
          } else {
            win._toggleLoading(false);
          }
        });
      } else if ( action === 'remove' ) {
        win._toggleLoading(true);
        inst.remove(self.currentArchive, arg, function(err) {
          if ( err ) {
            alert(err);
          }
          win._toggleLoading(false);
          self.action('open', file, self.currentPath);
        });
      } else if ( action === 'chdir' ) {
        self.action('open', self.currentArchive, arg || '/');
      } else if ( action === 'open' ) {
        self.currentArchive = arg || null;
        self.currentPath    = arg2 || '/';

        win.renderArchive(null, self.currentPath);
        win._toggleLoading(true);
        if ( self.currentArchive ) {
          inst.list(self.currentArchive, function(err, entries) {
            win._toggleLoading(false);

            win.renderArchive(entries, self.currentPath);
          });
        } else {
          win._toggleLoading(true);
          self.openCreateDialog(self.currentArchive, function(result) {
            if ( result ) {
              result.mime = 'application/zip';
              self.currentArchive = result;

              inst.create(result, function() {
                win._toggleLoading(false);

                self._setArgument('file', result);
                win.updateFile(result);

                win.renderArchive([], self.currentPath);
              }, self);
            } else {
              win._toggleLoading(false);
            }
          });
        }
      }

    });
  };

  ApplicationArchiver.prototype.openCreateDialog = function(file, cb) {
    var win = this._getMainWindow();
    win._toggleDisabled(true);

    API.createDialog('File', {
      filename: 'New Archive.zip',
      type: 'save'
    }, function(ev, btn, result) {
      win._toggleDisabled(false);
      cb(btn === 'ok' ? result : null);
    });
  };

  ApplicationArchiver.prototype.openExtractDialog = function(file, cb) {
    var win = this._getMainWindow();
    win._toggleDisabled(true);

    API.createDialog('File', {
      select: 'dir'
    }, function(ev, btn, result) {
      win._toggleDisabled(false);
      cb(btn === 'ok' ? result : null);
    });
  };

  ApplicationArchiver.prototype.openAddDialog = function(file, type, cb) {
    var win = this._getMainWindow();
    win._toggleDisabled(true);

    API.createDialog('File', {
      select: type
    }, function(ev, btn, result) {
      win._toggleDisabled(false);
      cb(btn === 'ok' ? result : null);
    });
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationArchiver = OSjs.Applications.ApplicationArchiver || {};
  OSjs.Applications.ApplicationArchiver.Class = ApplicationArchiver;

})(OSjs.Helpers.DefaultApplication, OSjs.Helpers.DefaultApplicationWindow, OSjs.Core.Application, OSjs.Core.Window, OSjs.Utils, OSjs.API, OSjs.VFS, OSjs.GUI);
