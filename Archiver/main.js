/*!
 * OS.js - JavaScript Operating System
 *
 * Copyright (c) 2011-2014, Anders Evenrud <andersevenrud@gmail.com>
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
(function(Application, CoreWindow, Window, GUI, Dialogs, Utils, API, VFS) {


  var requestFileSystem = window.webkitRequestFileSystem || window.mozRequestFileSystem || window.requestFileSystem;
  var URL = window.webkitURL || window.mozURL || window.URL;

  function getEntries(file, callback) {
    zip.createReader(new zip.BlobReader(file), function(zipReader) {
      zipReader.getEntries(function(entries) {
        callback(entries);
      });
    }, function(message) {
      alert(message); // FIXME
    });
  }

  function getEntryFile(entry, onend, onprogress) {
    var writer = new zip.BlobWriter();
    entry.getData(writer, function(blob) {
      onend(blob);
      writer = null;
    }, onprogress);
  }

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Main Window Constructor
   */
  var ApplicationArchiverWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationArchiverWindow', {width: 500, height: 400}, app]);

    // Set window properties and other stuff here
    this.view       = null;
    this.statusBar  = null;
    this.title      = metadata.name + ' v0.5';
    this._icon      = metadata.icon;
    this._title     = this.title;

    this.currentDir  = '/';
    this.currentList = [];
  };

  ApplicationArchiverWindow.prototype = Object.create(Window.prototype);

  ApplicationArchiverWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Create window contents (GUI) here
    var menuBar = this._addGUIElement(new GUI.MenuBar('ApplicationArchiverMenuBar'), root);
    menuBar.addItem(API._("File"), [
      {title: API._('New'), name: 'New', onClick: function() {
        app.action('new');
      }},
      {title: API._('Open'), name: 'Open', onClick: function() {
        app.action('open');
      }},
      {title: API._('Close'), name: 'Close', onClick: function() {
        self._close();
      }}
    ]);

    menuBar.addItem(API._("Add File"));
    menuBar.addItem(API._("Add Folder"));
    menuBar.addItem(API._("Extract to"));

    menuBar.onMenuOpen = function(menu, pos, title) {
      if ( menu && title === API._('File') ) {
        menu.setItemDisabled("Save", app.currentFile ? false : true);
      }
      if ( app.currentFile ) {
        if ( title === API._('Extract to') ) {
          self.onExtractClicked();
        }
        if ( title === API._('Add File') ) {
          self.onAddFileClicked();
        }
        if ( title === API._('Add Folder') ) {
          self.onAddFolderClicked();
        }
      }
    };

    function _callbackIcon(iter) {
      return API.getIcon(iter.icon, null, '16x16');
    }

    this.view = this._addGUIElement(new GUI.ListView('ArchiverListView'), root);
    this.view.setColumns([
      {key: 'icon',     title: '', type: 'image', callback: _callbackIcon, domProperties: {width: '16'}, resizable: false},
      {key: 'filename', title: API._('Filename')},
      {key: 'comment',  title: API._('Comment'), domProperties: {width: '100'}},
      {key: 'path',     title: API._('Path'), visible: false},
      {key: 'csize',    title: API._('Compressed Size'), domProperties: {width: '100'}, visible: false},
      {key: 'rsize',    title: API._('Size'), domProperties: {width: '100'}},
      {key: 'type',     title: '', visible: false}
    ]);
    this.view.onActivate = function(ev, el, item) {
      self.onItemActivated(item);
    };

    this.statusBar = this._addGUIElement(new GUI.StatusBar('ArchiverStatusBar'), root);
    this.statusBar.setText('Create new archive or open existing....');

    return root;
  };

  ApplicationArchiverWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);

    // Window has been successfully created and displayed.
    // You can start communications, handle files etc. here

    this.view.render();
  };

  ApplicationArchiverWindow.prototype._onDndEvent = function(ev, type, item, args) {
    if ( !CoreWindow.prototype._onDndEvent.apply(this, arguments) ) { return; }

    var self = this;
    function doDnD(data, menu) {
      var file = data instanceof window.File ? data : new VFS.File(data);

      if ( menu ) {
        OSjs.GUI.createMenu([
          {title: API._('Open arvhive'), onClick: function(ev) {
            self._appRef.action('open', file);
          }},
          {title: API._('Add to archive'), onClick: function(ev) {
            self._appRef.addFile(file, self.currentDir);
          }}
        ], {x: ev.clientX, y: ev.clientY});
      } else {
        self._appRef.addFile(file, self.currentDir);
      }
    }

    if ( item ) {
      var data = item.data;
      if ( type === 'itemDrop' ) {
        if ( data && data.type === 'file' && data.mime ) {
          if ( data.mime === 'application/zip' ) {
            doDnD(data, true);
          } else {
            doDnD(data);
          }
        }
      } else if ( type === 'filesDrop' ) {
        console.warn(item);
        if ( item.length ) {
          doDnD(item[0]);
        }
      }
    }
  };

  ApplicationArchiverWindow.prototype.destroy = function() {
    // Destroy custom objects etc. here

    Window.prototype.destroy.apply(this, arguments);

    this.view = null;
    this.staturBar = null;
  };

  ApplicationArchiverWindow.prototype.setTitle = function(name) {
    name = name || "New file";
    this._setTitle(this.title + " - " + Utils.filename(name));
  };

  ApplicationArchiverWindow.prototype.setChanged = function(c) {
  };

  ApplicationArchiverWindow.prototype.setStatusbar = function(t) {
    if ( this.statusBar ) {
      this.statusBar.setText(t);
    }
  }

  ApplicationArchiverWindow.prototype.onExtractClicked = function() {
    if ( this._appRef ) {
      this._appRef.extract();
    }
  };

  ApplicationArchiverWindow.prototype.onItemActivated = function(item) {
    if ( item ) {
      if ( item.type === 'dir' ) {
        this.currentDir = item.path;
        this._renderList();
      }
    }
  };

  ApplicationArchiverWindow.prototype._renderList = function() {
    var dir = this.currentDir;
    var rows = [];
    var totalsize = 0;

    var list = this.currentList.filter(function(o) {
      var cur = '/' + o.filename;
      if ( (o.directory && (dir === Utils.dirname(cur))) ) {
        return o;
      }
      if ( (!o.directory && (Utils.dirname(cur) === dir)) ) {
        return o;
      }

      return false;
    });

    console.log('Rendering list', dir, list);

    if ( this.view ) {
      if ( dir != '/' ) {
        rows.push({
          icon: 'places/folder.png',
          filename: '..',
          path: Utils.dirname(dir),
          size: 0,
          type: 'dir'
        });
      }

      var file;
      list.forEach(function(iter) {
        var file = {
          icon: iter.directory ? 'places/folder.png' : 'mimetypes/gtk-file.png',
          filename: Utils.filename('/' + iter.filename),
          path: (iter.directory ? ('/' + iter.filename) : Utils.dirname('/' + iter.filename)).replace(/\/$/, '') || '/',
          rsize: Utils.humanFileSize(iter.uncompressedSize),
          csize: Utils.humanFileSize(iter.compressedSize),
          type: iter.directory ? 'dir' : 'file',
          comment: iter.comment || ''
        };
        rows.push(file);

        totalsize += iter.uncompressedSize;
      });

      this.view.setRows(rows);
      this.view.render();

    }

    if ( this.statusBar ) {
      var txt = Utils.format('{2} total, {0} entries in {1}', rows.length, dir, Utils.humanFileSize(totalsize));
      this.statusBar.setText(txt);
    }
  };

  ApplicationArchiverWindow.prototype.renderList = function(list, args) {
    args = args || {};
    list = list || [];

    this.currentList = list;
    this.currentDir = args.dir || '/';

    this._renderList();
  }

  ApplicationArchiverWindow.prototype.onAddFileClicked = function() {
    if ( this._appRef ) {
      this._appRef.addFile(null, this.currentDir);
    }
  };

  ApplicationArchiverWindow.prototype.onAddFolderClicked = function() {
    if ( this._appRef ) {
      this._appRef.addFile(null, this.currentDir, true);
    }
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application constructor
   */
  var ApplicationArchiver = function(args, metadata) {
    Application.apply(this, ['ApplicationArchiver', args, metadata]);

    // You can set application variables here
    this.zip = null;

    this.defaultCheckChange  = true;
    this.dialogOptions.upload = true;
    this.dialogOptions.mimes = metadata.mime;
    this.dialogOptions.defaultFilename = "New archive.zip";
    this.dialogOptions.defaultMime = "application/zip";
  };

  ApplicationArchiver.prototype = Object.create(Application.prototype);

  ApplicationArchiver.prototype.destroy = function() {
    return Application.prototype.destroy.apply(this, arguments);
  };

  ApplicationArchiver.prototype.init = function(settings, metadata) {
    this.mainWindow = this._addWindow(new ApplicationArchiverWindow(this, metadata));

    var rootName = API.getApplicationResource(this, 'vendor/zip.js/WebContent/');
    zip.workerScriptsPath = rootName;

    Application.prototype.init.apply(this, arguments);
  };

  ApplicationArchiver.prototype._onMessage = function(obj, msg, args) {
    Application.prototype._onMessage.apply(this, arguments);

    // Make sure we kill our application if main window was closed
    if ( msg == 'destroyWindow' && obj._name === 'ApplicationArchiverWindow' ) {
      this.destroy();
    }
  };

  ApplicationArchiver.prototype.onNew = function() {
    lastDir = '/';
    var self = this;

    function createEmpty(cb) {
      if ( !self.currentFile ) {
        return cb();
      }

      var writer = new zip.BlobWriter();
      zip.createWriter(writer, function(writer) {
        writer.close(function(blob) {
          VFS.upload({
            destination: Utils.dirname(self.currentFile.path),
            files: [{filename: Utils.filename(self.currentFile.path), data: blob, _overwrite: true}]
            }, function(error, result) {
              if ( error ) {
                console.warn('Error creating blank zip', error);
              }
              writer = null;

              cb();
            });
        });
      });
    }

    function updateWindow(file) {
      self.currentFile = file || null;
      if ( self.currentFile ) {
        self.currentFile.mime = 'application/zip';
      }

      if ( self.mainWindow ) {
        self.mainWindow._toggleLoading(true);

        createEmpty(function() {
          self.mainWindow._toggleLoading(false);
          //self.mainWindow.setChanged(false);
          self.mainWindow.setTitle(file ? file.path : null);
          self.mainWindow.renderList();
          self.mainWindow._focus();
        });
      }
    }

    updateWindow();

    this._onSaveAs(function(item) {
      updateWindow(item);
    });
  };

  ApplicationArchiver.prototype.onOpen = function(file, data, sendArgs) {
    if ( this.mainWindow ) {
      //this.mainWindow.setChanged(false);
      this.mainWindow.setTitle(file.path);
      this.mainWindow._focus();

      this.read(file, sendArgs);
    }
  };

  ApplicationArchiver.prototype.onSave = function(file, data) {
    if ( this.mainWindow ) {
      //this.mainWindow.setChanged(false);
      this.mainWindow.setTitle(file.path);
      this.mainWindow._focus();
    }
  };

  ApplicationArchiver.prototype.onGetSaveData = function(callback) {
    callback(null);
  };

  /**
   * Sets current Zip file
   */
  ApplicationArchiver.prototype.read = function(file, args) {
    var self = this;

    function onOpen(file) {
      getEntries(file, function(entries) {
        if ( self.mainWindow ) {
          self.mainWindow.renderList(entries, args);
        }
      });
    }

    function onRead(data) {
      var blob = new Blob([data], {type: 'application/zip'});
      onOpen(blob);
    }

    VFS.download(file, function(error, result) {
      if ( error ) {
        alert(error);
        return;
      }
      onRead(result);
    });
  };

  /**
   * Re-create zip with new file
   */
  ApplicationArchiver.prototype.addFile = function(reqFile, currentDir, isFolder) {
    if ( !this.currentFile ) {
      throw new Error('You have to create a new archive or open a existing one to add files.');
    }
    var self =  this;
    var entries = [];
    var opt = { // FIXME
      path: '/',
      type: 'open'
    };

    var zipWriter;

    function updateStatusbar(t) {
      if ( self.mainWindow ) {
        self.mainWindow.setStatusbar(t);
      }
    }

    function _onError(error) {
      if ( self.mainWindow ) {
        self.mainWindow._toggleLoading(false);
      }
      if ( error ) {
        alert(error);
      }
    }

    function _openZip(cb) {
      VFS.download(self.currentFile, function(error, data) {
        if ( error ) {
          console.warning('An error while opening zip', error);
          return _onError(error);
        }

        var blob = new Blob([data], {type: self.currentFile.mime});
        getEntries(blob, function(result) {
          entries = result;

          cb();
        });
      });
    }

    function _importFiles(cb) {
      console.group('ApplicationArchiver::addFile()=>_importFiles()')

      function _importList(list) {
        function _next(index) {
          if ( !list.length || index >= list.length ) {
            console.groupEnd();
            return cb();
          }

          var current = list[index];
          console.log('Importing', index, current);
          getEntryFile(current, function(blob) {
            zipWriter.add(current.filename, new zip.BlobReader(blob), function() {
              console.log('Imported', current);
              updateStatusbar(Utils.format('Added {0}', current.filename));
              _next(index+1);
            }, function(current, total) {
              updateStatusbar(Utils.format('Reading file {0} {1}/{2}', current.filename, current, total));
            }, {
              directory: current.directory,
              lastModDate: current.lastModDate,
              version: current.version
            });
          });
        }

        _next(0);
      }

      _importList(entries);
    }

    function _createZip(cb) {
      var writer = new zip.BlobWriter();
      zip.createWriter(writer, function(writer) {
        zipWriter = writer;

        _importFiles(function() {
          updateStatusbar('Imported files...');

          cb();
        });
      }, function(error) {
        console.error('ApplicationArchiver::addFile()=>createZip()', arguments);
        updateStatusbar('Error while creating zip: ' + error);
        _onError(error);
      });
    }

    function _saveChanges(cb) {
      console.log('Saving changes');

      zipWriter.close(function(blob) {
        VFS.upload({
          destination: Utils.dirname(self.currentFile.path),
          files: [{filename: Utils.filename(self.currentFile.path), data: blob, _overwrite: true}]
          }, function(error, result) {
            cb(error);

            console.log('Saved changes', error);
            zipWriter = null;
            if ( error ) {
              _onError(error);
            } else {
              self._onOpen(self.currentFile, {dir: self.mainWindow ? self.mainWindow.currentDir : '/'});
            }
        });
      });
    }

    function _addFile(item, cb) {
      var filename = item instanceof window.File ? item.name : item.filename;
      var type = item instanceof window.File ? 'file' : (item.type || 'file');

      filename = ((currentDir || '/').replace(/\/$/, '') + '/' + filename).replace(/^\//, '');
      function _addBlob(blob) {
        zipWriter.add(filename, new zip.BlobReader(blob), function() {
          console.log('ADDED FILE', filename);

          _saveChanges(cb);
        }, function(current, total) {
          updateStatusbar(Utils.format('Compressing file {0} {1}/{2}', filename, current, total));
        });
      }

      function _addFolder() {
        zipWriter.add(filename, null, function() {
          console.log('ADDED FOLDER', filename);

          _saveChanges(cb);
        }, null, {directory: true});
      }

      if ( type === 'dir' ) {
        _addFolder();
      } else {
        if ( item instanceof window.File ) {
          _addBlob(item);
        } else {
          VFS.download(item, function(error, data) {
            if ( error ) {
              return _onError(error);
            }

            var blob = new Blob([data], {type: item.mime});
            _addBlob(blob);
          });
        }
      }
    }

    function _onFinish(error) {
      if ( self.mainWindow ) {
        self.mainWindow._toggleLoading(false);
      }
      _onError(error);
    }

    function _checkExistence(item, cb) {
      var chk = Utils.filename(item.path); //VFS.getRelativeURL(item.path).replace(/^\//, '');
      var found = false;

      entries.forEach(function(i) {
        if ( i.filename === chk ) {
          if ( !i.directory || (i.directory && item.type === 'dir') ) {
            found = true;
          }
        }
        return !found;
      });

      cb(found ? 'File is already in archive' : null);
    }

    function _initAdd(item) {
      if ( self.mainWindow ) {
        self.mainWindow._toggleLoading(true);
      }

      _openZip(function() {
        _checkExistence(item, function(error) {
          if ( error ) {
            return _onFinish(error);
          }

          _createZip(function() {
            _addFile(item, function(error) {
              _onFinish(error);
            });
          });
        });
      });
    }

    if ( isFolder ) {
      if ( this.mainWindow ) {
        this.mainWindow._toggleDisabled(true);
      }
      this._createDialog('Input', [API._('Create a new directory in <span>{0}</span>', self.currentDir), '', function(btn, value) {
        if ( self.mainWindow ) {
          self.mainWindow._toggleDisabled(false);
        }
        if ( btn === 'ok' && value ) {
          _initAdd({
            filename: value,
            path: value,
            type: 'dir'
          });
        }
      }], this.mainWindow);

    } else {
      if ( reqFile ) {
        _initAdd(reqFile);
      } else {
        this.mainWindow._toggleDisabled(true);
        this._createDialog('File', [opt, function(btn, item) {
          self.mainWindow._toggleDisabled(false);
          if ( btn === 'ok' && item ) {
            _initAdd(item);
          }
        }], this.mainWindow);
      }
    }
  };

  /**
   * Extracts current Zip file
   */
  ApplicationArchiver.prototype.extract = function() {
    if ( !this.currentFile ) {
      throw new Error('You have to create a new archive or open a existing one to extract files.');
    }

    var file = this.currentFile;
    var self = this;
    var extracted = [];
    var warnings = [];
    var total = 0;

    function updateStatusbar(t) {
      if ( self.mainWindow ) {
        self.mainWindow.setStatusbar(t);
      }
    }

    function _onEnd(error) {
      if ( error ) {
        alert(error);
      }
      if ( self.mainWindow ) {
        self.mainWindow._toggleLoading(false);
      }

      var msg = Utils.format('Extracted {0} of {1}, {2} warning(s)', extracted.length, total, warnings.length);
      updateStatusbar(msg);

      if ( warnings ) {
        var msg = warnings.join('\n');
        API.error('Warnings while extracting', 'Something went wrong whie extracting files', msg);
      }
    }

    function _extractList(list, destination) {
      total = list.length;

      var index = 0;

      function _extract(item, cb) {
        updateStatusbar(Utils.format('Extracting {0}', item.filename));

        var dest = destination;
        if ( item.filename.match(/\//) ) {
          if ( item.directory ) {
            dest += '/' + item.filename;
          } else {
            dest += '/' + Utils.dirname(item.filename);
          }
        }

        console.log('Extract', item, dest);
        if ( item.directory ) {
          VFS.mkdir(new VFS.File(dest), function(error, result) {
            if ( error ) {
              warnings.push(Utils.format('Could not create directory "{0}": {1}', item.filename, error));
            } else {
              extracted.push(item.filename);
            }

            cb();
          });
          return;
        }

        getEntryFile(item, function(blob) {
          console.log('....', blob);
          VFS.upload({
            destination: dest,
            files: [{filename: Utils.filename(item.filename), data: blob}]
          }, function(error, result, ev) {
            if ( error ) {
              warnings.push(Utils.format('Could not extract "{0}": {1}', item.filename, error));
            } else {
              extracted.push(item.filename);
            }

            cb();
          });
        }, function() {
        });
      }

      function _finished() {
        console.log('Extract finished', total, 'total', extracted.length, 'extracted', extracted);
        console.log(warnings.length, 'warnings', warnings);
        _onEnd();
      }

      function _next() {
        if ( !list.length || index >= list.length ) {
          return _finished();
        }

        _extract(list[index], function() {
          index++;
          _next();
        });
      }

      _next();
    }

    function _extractTo(blob, destination) {
      if ( self.mainWindow ) {
        self.mainWindow._toggleLoading(true);
      }

      getEntries(blob, function(entries) {
        _extractList(entries, destination);
      });
    }

    function _readZip(data, destination) {
      var blob = new Blob([data], {type: 'application/zip'});
      _extractTo(blob, destination);
    }

    function _selectDirectory(btn, item) {
      if ( btn === 'ok' ) {
        VFS.download(file, function(error, result) {
          if ( error ) {
            return _onEnd(error);
          }
          _readZip(result, item.path);
        });
      }
    }

    if ( file ) {
      var opt = { // FIXME
        select: 'path',
        path: '/',
        mkdir: true,
        type: 'open'
      };

      this.mainWindow._toggleDisabled(true);
      this._createDialog('File', [opt, function(btn, item) {
        self.mainWindow._toggleDisabled(false);

        _selectDirectory(btn, item);
      }], this.mainWindow);
    }
  };

  //
  // EXPORTS
  //
  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationArchiver = OSjs.Applications.ApplicationArchiver || {};
  OSjs.Applications.ApplicationArchiver.Class = ApplicationArchiver;

})(OSjs.Helpers.DefaultApplication, OSjs.Core.Window, OSjs.Helpers.DefaultApplicationWindow, OSjs.GUI, OSjs.Dialogs, OSjs.Utils, OSjs.API, OSjs.VFS);
