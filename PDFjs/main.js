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
import {PDFJS} from 'pdfjs-dist';
const DOM = OSjs.require('utils/dom');
const Utils = OSjs.require('utils/misc');
const DefaultApplication = OSjs.require('helpers/default-application');
const DefaultApplicationWindow = OSjs.require('helpers/default-application-window');

class ApplicationPDFjsWindow extends DefaultApplicationWindow {

  /**
   * Main Window Constructor
   */
  constructor(app, metadata, file) {
    super('ApplicationPDFjsWindow', {
      allow_drop: true,
      icon: metadata.icon,
      title: metadata.name,
      width: 500,
      height: 400
    }, app, file);

    this.pageCount = 0;
    this.pageIndex = 0;
    this.pdf = null;
    this.currentScale = 1.5;
  }

  init(wmRef, app) {
    var root = super.init(...arguments);
    var self = this;

    // Load and set up scheme (GUI) here
    this._render('PDFWindow', require('osjs-scheme-loader!scheme.html'));

    this._find('Prev').on('click', function() {
      self.prevPage();
    });
    this._find('Next').on('click', function() {
      self.nextPage();
    });
    this._find('In').on('click', function() {
      self.zoomIn();
    });
    this._find('Out').on('click', function() {
      self.zoomOut();
    });

    return root;
  }

  destroy() {
    this.pdf = null;
    return super.destroy(...arguments);
  }

  open(file, url) {
  }

  page(pageNum) {
    var self = this;

    if ( this.pageCount <= 0 || pageNum <= 0 || pageNum > this.pageCount ) {
      return;
    }

    var container = this._find('Content').$element;
    DOM.$empty(container);

    this.pageIndex = pageNum;

    var statustext = Utils.format('Page {0}/{1} - {2}%', this.pageIndex, this.pageCount, this.currentScale * 100);
    this._find('Statusbar').set('value', statustext);

    this.pdf.getPage(this.pageIndex).then(function getPageHelloWorld(page) {
      var scale = self.currentScale;
      var viewport = page.getViewport(scale);
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      container.appendChild(canvas);

      var renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      page.render(renderContext);
    });
  }

  prevPage() {
    this.page(this.pageIndex - 1);
  }

  nextPage() {
    this.page(this.pageIndex + 1);
  }

  zoomIn() {
    this.currentScale += 0.5;
    this.page(this.pageIndex);
  }

  zoomOut() {
    if ( this.currentScale > 0.5 ) {
      this.currentScale -= 0.5;
    }
    this.page(this.pageIndex);
  }

  showFile(file, result) {
    var self = this;
    var container = this._find('Content').$element;

    DOM.$empty(container);

    this.pageCount = 0;
    this.pageIndex = 0;

    PDFJS.getDocument(result).then(function getPdfHelloWorld(pdf) {
      self.pageCount = pdf.numPages;
      self.pdf = pdf;
      self.page(1);
    });

    return super.showFile(...arguments);
  }
}

class ApplicationPDFjs extends DefaultApplication {
  constructor(args, metadata) {
    super('ApplicationPDFjs', args, metadata, {
      readData: false
    });

    PDFJS.workerSrc = this._getResource('pdf.worker.js');
  }

  init(settings, metadata) {
    super.init(...arguments);
    var file = this._getArgument('file');
    this._addWindow(new ApplicationPDFjsWindow(this, metadata, file));
  }
}

OSjs.Applications.ApplicationPDFjs = ApplicationPDFjs;

