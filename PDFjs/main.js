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
(function(Application, Window, GUI, Utils, API, VFS) {

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Main Window Constructor
   */
  var ApplicationPDFjsWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationPDFjsWindow', {
      icon: metadata.icon,
      title: metadata.name,
      width: 500,
      height: 400
    }, app]);

    this.title = metadata.name;
    this.$container = null;
    this.pageCount = 0;
    this.pageIndex = 0;
    this.file = null;
    this.pdf = null;
    this.currentScale = 1.5;
  };

  ApplicationPDFjsWindow.prototype = Object.create(Window.prototype);

  ApplicationPDFjsWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    var _createIcon = function(i) {
      return OSjs.API.getThemeResource(i, 'icon');
    };

    // Create window contents (GUI) here
    var menuBar = this._addGUIElement(new GUI.MenuBar('ApplicationPDFjsMenuBar'), root);
    menuBar.addItem(API._("LBL_FILE"), [
      {title: API._('LBL_OPEN'), name: 'Open', onClick: function() {
        app.action('open');
      }},
      {title: API._('LBL_CLOSE'), name: 'Close', onClick: function() {
        self._close();
      }}
    ]);

    var toolBar = this._addGUIElement(new GUI.ToolBar('ApplicationPDFjsToolBar'), root);
    toolBar.addItem('prevPage', {title: 'Previous page', icon: _createIcon('actions/go-previous.png'), onClick: function(ev, el, name, item) {
      self.prevPage();
    }});
    toolBar.addItem('nextPage', {title: 'Next page', icon: _createIcon('actions/go-next.png'), onClick: function(ev, el, name, item) {
      self.nextPage();
    }});
    toolBar.addItem('zoomOut', {title: 'Zoom out', icon: _createIcon('actions/zoom-out.png'), onClick: function(ev, el, name, item) {
      self.zoomOut();
    }});
    toolBar.addItem('zoomIn', {title: 'Zoom in', icon: _createIcon('actions/zoom-in.png'), onClick: function(ev, el, name, item) {
      self.zoomIn();
    }});
    toolBar.render();

    this.$container = document.createElement('div');
    this.$container.className = 'PDFContainer';
    root.appendChild(this.$container);

    return root;
  };

  ApplicationPDFjsWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);

    // Window has been successfully created and displayed.
    // You can start communications, handle files etc. here

  };

  ApplicationPDFjsWindow.prototype.destroy = function() {
    // Destroy custom objects etc. here

    Window.prototype.destroy.apply(this, arguments);

    if ( this.$container ) {
      if ( this.$container.parentNode ) {
        this.$container.parentNode.removeChild(this.$container);
      }
      this.$container = null;
    }

    this.file = null;
    this.pdf = null;
  };

  ApplicationPDFjsWindow.prototype.open = function(file, url) {
    var self = this;

    Utils.$empty(this.$container);

    this._setTitle(this.title);

    this.pageCount = 0;
    this.pageIndex = 0;

    PDFJS.getDocument(url).then(function getPdfHelloWorld(pdf) {
      console.warn("XXX", file, url, pdf);

      self.pageCount = pdf.numPages;
      self.file = file;
      self.pdf = pdf;

      self.page(1);
    });
  };

  ApplicationPDFjsWindow.prototype.page = function(pageNum) {
    var self = this;

    if ( this.pageCount <= 0 || pageNum <= 0 || pageNum > this.pageCount ) {
      return;
    }

    Utils.$empty(this.$container);

    this.pageIndex = pageNum;

    this._setTitle(Utils.format('{0} - {1} (Page {2}/{3}) - {4}%', this.title, this.file.filename, this.pageIndex, this.pageCount, this.currentScale*100));

    this.pdf.getPage(this.pageIndex).then(function getPageHelloWorld(page) {
      var scale = self.currentScale;
      var viewport = page.getViewport(scale);
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      self.$container.appendChild(canvas);

      var renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      page.render(renderContext);
    });
  };

  ApplicationPDFjsWindow.prototype.prevPage = function() {
    this.page(this.pageIndex-1);
  };

  ApplicationPDFjsWindow.prototype.nextPage = function() {
    this.page(this.pageIndex+1);
  };

  ApplicationPDFjsWindow.prototype.zoomIn = function() {
    this.currentScale += 0.5;
    this.page(this.pageIndex);
  };

  ApplicationPDFjsWindow.prototype.zoomOut = function() {
    if ( this.currentScale > 0.5 ) {
      this.currentScale -= 0.5;
    }
    this.page(this.pageIndex);
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application constructor
   */
  var ApplicationPDFjs = function(args, metadata) {
    Application.apply(this, ['ApplicationPDFjs', args, metadata]);

    // You can set application variables here
    this.mainWindow = null;

    this.dialogOptions.mimes = metadata.mime;
    this.dialogOptions.read  = false;

    window.PDFJS = window.PDFJS || {};
    var src = API.getApplicationResource(this, 'vendor/pdf.js/src/worker_loader.js');
    PDFJS.workerSrc = src;
  };

  ApplicationPDFjs.prototype = Object.create(Application.prototype);

  ApplicationPDFjs.prototype.destroy = function() {
    // Destroy communication, timers, objects etc. here
    this.mainWindow = null;

    return Application.prototype.destroy.apply(this, arguments);
  };

  ApplicationPDFjs.prototype.init = function(settings, metadata) {
    var self = this;

    this.mainWindow = this._addWindow(new ApplicationPDFjsWindow(this, metadata));

    Application.prototype.init.apply(this, arguments);
  };

  ApplicationPDFjs.prototype._onMessage = function(obj, msg, args) {
    Application.prototype._onMessage.apply(this, arguments);

    // Make sure we kill our application if main window was closed
    if ( msg == 'destroyWindow' && obj._name === 'ApplicationPDFjsWindow' ) {
      this.destroy();
    }
  };

  ApplicationPDFjs.prototype.onOpen = function(file, data) {
    var self = this;
    if ( this.mainWindow ) {
      this.mainWindow._focus();

      VFS.url(file, function(error, url) {
        if ( !self.mainWindow ) { return; }

        if ( error ) {
          alert(error); // FIXME
          return;
        }

        self.mainWindow.open(file, url);
      });
    }
  };

  //
  // EXPORTS
  //
  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationPDFjs = OSjs.Applications.ApplicationPDFjs || {};
  OSjs.Applications.ApplicationPDFjs.Class = ApplicationPDFjs;

})(OSjs.Helpers.DefaultApplication, OSjs.Helpers.DefaultApplicationWindow, OSjs.GUI, OSjs.Utils, OSjs.API, OSjs.VFS);
