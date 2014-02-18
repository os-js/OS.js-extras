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

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Main Window
   */
  var ApplicationTesterWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationTesterWindow', {width: 600, height: 450}, app]);

    // Set window properties here
    this._title = metadata.name;
    this._icon  = metadata.icon;
  };

  ApplicationTesterWindow.prototype = Object.create(Window.prototype);

  ApplicationTesterWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;
    // Create window contents here
    var tabs = this._addGUIElement(new OSjs.GUI.Tabs('TesterTabs'), root);

    //this.createApplicationTab(tabs);
    //this.createCoreTab(tabs);
    this.createDialogTab(tabs);
    this.createGUITab(tabs);

    return root;
  };

  ApplicationTesterWindow.prototype.destroy = function() {
    // Destroy custom objects etc. here

    Window.prototype.destroy.apply(this, arguments);
  };

  ApplicationTesterWindow.prototype.createApplicationTab = function(tabs) {
    var self = this;
    var el = tabs.addTab("Application", {title: "Application"});
  };

  ApplicationTesterWindow.prototype.createCoreTab = function(tabs) {
    var self = this;
    var el = tabs.addTab("Core", {title: "Core"});
  };

  ApplicationTesterWindow.prototype.createDialogTab = function(tabs) {
    var self = this;
    var el = tabs.addTab("Dialogs", {title: "Dialogs"});
    var container = document.createElement('div');
    container.className = 'Dialogs';

    var app = this._appRef;
    var win = this;

    var _closeDialog = function(button, result) {
      if ( button === 'destroy' ) return;
      alert("You pressed: " + button + "\nResult: " + JSON.stringify(result));
    };

    var _createDialog = function(name) {
      var opts = [];
      switch ( name ) {
        case 'ApplicationChooser' :
          var apps = OSjs.API.getHandlerInstance().getApplicationsMetadata();
          var fname = OSjs.API.getDefaultPath() + '/test.txt';
          opts = [fname, 'text/plain', apps, function(btn, val, def) {
            _closeDialog(btn, {application: val, useDefault: def});
          }];
        break;

        case 'FileProgress' :
          opts = ['File progress dialog', function(btn, val) {
            _closeDialog(btn, {value: val});
          }];
        break;
        case 'FileUpload' :
          opts = ['/foo/bar/', {}, function(btn, result) { // FIXME
            _closeDialog(btn, {result: result});
          }];
        break;
        case 'File' :
          opts = [{}, function(btn, item) {
            _closeDialog(btn, {item: item});
          }];
        break;
        case 'FileInfo' :
          opts = ['/foo.bar', function(btn, item) { // FIXME
            _closeDialog(btn, {item: item});
          }];
        break;

        case 'Input' :
          opts = ['Input dialog description', 'Default value', function(btn, val) {
            _closeDialog(btn, {value: val});
          }];
        break;
        case 'Alert' :
          opts = ['Alert dialog message', function(btn) {
            _closeDialog(btn);
          }];
        break;
        case 'Confirm' :
          opts = ['Confirm dialog message', function(btn) {
            _closeDialog(btn);
          }];
        break;

        case 'Color' :
          opts = [{}, function(btn, rgb, hex, alpha) {
            _closeDialog(btn, {rgb: rgb, hex: hex, alpha: alpha});
          }];
        break;
        case 'Font' :
          opts = [{}, function(btn, name, size) {
            _closeDialog(btn, {name: name, size: size});
          }];
        break;
      }
      app._createDialog(name, opts, win);
    };

    var _createButton = function(name) {
      self._addGUIElement(new OSjs.GUI.Button(name, {label: name, onClick: function() {
        _createDialog(name);
      }}), container);
    };

    _createButton('ApplicationChooser');
    _createButton('FileProgress');
    _createButton('FileUpload');
    _createButton('File');
    _createButton('FileInfo');
    _createButton('Input');
    _createButton('Alert');
    _createButton('Confirm');
    _createButton('Color');
    _createButton('Font');

    el.appendChild(container);
  };

  ApplicationTesterWindow.prototype.createGUITab = function(tabs) {
    var self = this;
    var el = tabs.addTab("GUI", {title: 'GUI'});
    var container = document.createElement('div');
    container.className = 'GUI';

    var  _createElement = function(obj, parentNode) {
      parentNode = parentNode || container;
      var inner = document.createElement('div');
      var gel = self._addGUIElement(obj, inner);
      parentNode.appendChild(inner);
      return gel;
    };

    var subMenu = [
      {title: 'Sub menu item 1'},
      {title: 'Sub menu item 2'}
    ];

    var menuBar = _createElement(new OSjs.GUI.MenuBar('TesterMenuBar'));
    menuBar.addItem("Menu Item", [
      {title: 'Sub Item 1', onClick: function() {
      }, menu: subMenu},
      {title: 'Sub Item 2', onClick: function() {
      }}
    ]);

    var textArea = _createElement(new OSjs.GUI.Textarea('TesterTextarea'));
    textArea.setText("Text Area");

    var colorSwatch = _createElement(new OSjs.GUI.ColorSwatch('TesterColorSwatch'));

    var statusBar = _createElement(new OSjs.GUI.StatusBar('TesterStatusBar'));
    statusBar.setText('This is a status bar');

    var sliderHorizontal = _createElement(new OSjs.GUI.Slider('TesterSliderHorizontal', {min: 0, max: 100, val: 0}));

    var sliderVertical = _createElement(new OSjs.GUI.Slider('TesterSliderVertical', {min: 0, max: 100, val: 0, orientation: 'vertical'}));

    var toolBar = _createElement(new OSjs.GUI.ToolBar('TesterToolBar'));
    toolBar.addItem("Button1", {title: 'Button 1'});
    toolBar.addItem("Button2", {title: 'Button 2'});
    toolBar.addItem("Button3", {title: 'Button 3'});
    toolBar.render();

    var panedView = _createElement(new OSjs.GUI.PanedView('TesterPanedView'));
    var panedView1 = panedView.createView('View1');
    var panedView2 = panedView.createView('View2');

    var canvas1 = _createElement(new OSjs.GUI.Canvas('TesterCanvas1'), panedView1);
    var canvas2 = _createElement(new OSjs.GUI.Canvas('TesterCanvas2'), panedView2);

    var progressbarHorizontal = _createElement(new OSjs.GUI.ProgressBar('TesterProgressBarHorizontal'));
    progressbarHorizontal.setProgress(50);

    var listView = _createElement(new OSjs.GUI.ListView('TesterListView'));
    listView.setColumns([
      {'key': 'Column1', 'title': 'Column 1', domProperties: {width: 100}},
      {'key': 'Column2', 'title': 'Column 2'}
    ]);
    listView.setRows([
      {'Column1': 'Test item 1', 'Column2': 'Test item 1'},
      {'Column1': 'Test item 2', 'Column2': 'Test item 2'}
    ]);
    listView.render();

    var iconView = _createElement(new OSjs.GUI.IconView('TesterIconView'));
    iconView.setData([
      {label: 'IconView 1', icon: OSjs.API.getThemeResource('apps/xfwm4.png', 'icon')},
      {label: 'IconView 2', icon: OSjs.API.getThemeResource('apps/xfwm4.png', 'icon')},
      {label: 'IconView 3', icon: OSjs.API.getThemeResource('apps/xfwm4.png', 'icon')}
    ]);
    iconView.render();

    var richText = _createElement(new OSjs.GUI.RichText('TesterRichText', {
      onInited: function() {
        this.setContent('<h1>Rich Text</h1>');
      }
    }));

    var select = _createElement(new OSjs.GUI.Select('TesterSelect'));
    select.addItems({
      'yes':  'Selection box Yes',
      'no':   'Selection box No'
    });

    var text = _createElement(new OSjs.GUI.Text('TesterTextbox'));
    text.setValue("Text input");

    var password = _createElement(new OSjs.GUI.Text('TesterPasswordbox', {type: 'password'}));
    password.setValue("Password input");

    var checkbox = _createElement(new OSjs.GUI.Checkbox('TesterCheckbox', {label: 'Checkbox'}));
    var radio1 = _createElement(new OSjs.GUI.Radio('TesterRadio1', {label: 'Radio 1'}));
    var radio2 = _createElement(new OSjs.GUI.Radio('TesterRadio2', {label: 'Radio 2'}));

    el.appendChild(container);
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application
   */
  var ApplicationTester = function(args, metadata) {
    Application.apply(this, ['ApplicationTester', args, metadata]);
  };

  ApplicationTester.prototype = Object.create(Application.prototype);

  ApplicationTester.prototype.destroy = function() {
    return Application.prototype.destroy.apply(this, []);
  };

  ApplicationTester.prototype.init = function(core, session, metadata) {
    Application.prototype.init.apply(this, arguments);
    var self = this;

    this._addWindow(new ApplicationTesterWindow(this, metadata));
  };

  ApplicationTester.prototype._onMessage = function(obj, msg, args) {
    Application.prototype._onMessage.apply(this, arguments);

    if ( msg == 'destroyWindow' && obj._name === 'ApplicationTesterWindow' ) {
      this.destroy();
    }
  };

  //
  // EXPORTS
  //
  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationTester = ApplicationTester;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.Core.GUI, OSjs.Core.Dialogs);
