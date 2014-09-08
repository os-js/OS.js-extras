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
(function(Application, Window, GUI, Dialogs) {

  // view-source:http://threejs.org/examples/canvas_particles_sprites.html

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (function() {
      return window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
        window.setTimeout(callback, 1000 / 60);

      };

    })();
  }

  function generateSprite() {
    var canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;

    var context = canvas.getContext('2d');
    var gradient = context.createRadialGradient( canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2 );
    gradient.addColorStop( 0,   'rgba(255,255,255,1)' );
    gradient.addColorStop( 0.2, 'rgba(0,255,255,1)' );
    gradient.addColorStop( 0.4, 'rgba(0,0,64,1)' );
    gradient.addColorStop( 1,   'rgba(0,0,0,1)' );

    context.fillStyle = gradient;
    context.fillRect( 0, 0, canvas.width, canvas.height );

    return canvas;
  }

  function initParticle( particle, delay ) {
    var particle = this instanceof THREE.Sprite ? this : particle;
    var delay = delay !== undefined ? delay : 0;

    particle.position.set( 0, 0, 0 );
    particle.scale.x = particle.scale.y = Math.random() * 32 + 16;

    new TWEEN.Tween( particle )
      .delay( delay )
      .to( {}, 10000 )
      .onComplete( initParticle )
      .start();

    new TWEEN.Tween( particle.position )
      .delay( delay )
      .to( { x: Math.random() * 4000 - 2000, y: Math.random() * 1000 - 500, z: Math.random() * 4000 - 2000 }, 10000 )
      .start();

    new TWEEN.Tween( particle.scale )
      .delay( delay )
      .to( { x: 0, y: 0 }, 10000 )
      .start();
  }


  var MyScene = function(container) {
    if ( !container ) { throw "MyScene expects a container"; }

    this.container  = container;
    this.scene      = null;
    this.camera     = null;
    this.renderer   = null;
    this.stats      = null;

    this.mouseX     = 0;
    this.mouseY     = 0;

    this.paused     = false;
    this.destroyed  = false;
    this.inited     = false;
  };

  MyScene.prototype.init = function() {
    this.scene = new THREE.Scene();

    var SCREEN_WIDTH  = this.container.offsetWidth,
        SCREEN_HEIGHT = this.container.offsetHeight;

    var VIEW_ANGLE  = 75,
        ASPECT      = SCREEN_WIDTH / SCREEN_HEIGHT,
        NEAR        = 1,
        FAR         = 5000;

    this.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    this.camera.position.z = 1000;
    this.scene.add(this.camera);

    this.renderer = new THREE.CanvasRenderer();
    //this.renderer = new THREE.WebGLRenderer( {antialias:true} );
    this.renderer.setClearColor( 0x000040 );
    this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    this.container.appendChild(this.renderer.domElement);

    this.stats = new Stats();
    this.stats.domElement.style.position = 'absolute';
    this.stats.domElement.style.top = '0px';
    this.container.appendChild(this.stats.domElement);

    this.createScene();
  };

  MyScene.prototype.createScene = function(reinit) {
    if ( reinit ) {
      var SCREEN_WIDTH  = this.container.offsetWidth,
          SCREEN_HEIGHT = this.container.offsetHeight;

      this.camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    if ( this.inited ) {
      var obj, i;
      for ( i = this.scene.children.length - 1; i >= 0 ; i -- ) {
        obj = this.scene.children[ i ];
        if ( obj !== this.camera) {
          this.scene.remove(obj);
        }
      }
    }

    var material = new THREE.SpriteMaterial( {
      map: new THREE.Texture( generateSprite() ),
        blending: THREE.AdditiveBlending
    } );

    var particle;
    for ( var i = 0; i < 1000; i++ ) {
      particle = new THREE.Sprite( material );
      initParticle( particle, i * 10 );
      this.scene.add( particle );
    }

    this.inited = true;
  };

  MyScene.prototype.destroy = function() {
    this.destroyed = true;
  };

  MyScene.prototype.resize = function() {
    this.createScene(true);
  };

  MyScene.prototype.pause = function() {
    this.paused = true;
  };

  MyScene.prototype.resume = function() {
    this.paused = false;
  };

  MyScene.prototype.animate = function() {
    if ( this.destroyed ) { return; }
    var self = this;
    window.requestAnimationFrame(function() {
      self.animate();
    });

    this.render();

    if ( this.stats ) {
      this.stats.update();
    }
  };

  MyScene.prototype.render = function() {
    if ( this.paused ) { return; }

    TWEEN.update();

    this.camera.position.x += ( this.mouseX - this.camera.position.x ) * 0.05;
    this.camera.position.y += ( - this.mouseY - this.camera.position.y ) * 0.05;
    this.camera.lookAt( this.scene.position );

    this.renderer.render( this.scene, this.camera );
  };

  /////////////////////////////////////////////////////////////////////////////
  // WINDOWS
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Main Window Constructor
   */
  var ApplicationThreejsWindow = function(app, metadata) {
    Window.apply(this, ['ApplicationThreejsWindow', {width: 600, height: 350}, app]);

    // Set window properties and other stuff here
    this._title = metadata.name;
    this._icon  = metadata.icon;
    //this._properties.allow_resize   = false;
    //this._properties.allow_maximize = false;

    this.scene = null;
  };

  ApplicationThreejsWindow.prototype = Object.create(Window.prototype);

  ApplicationThreejsWindow.prototype.init = function(wmRef, app) {
    var root = Window.prototype.init.apply(this, arguments);
    var self = this;

    // Create window contents (GUI) here
    var _resize = function() {
      if ( self.scene ) {
        self.scene.resize();
      }
    };

    var _pause = function() {
      if ( self.scene ) {
        self.scene.pause();
      }
    };
    var _resume = function() {
      if ( self.scene ) {
        self.scene.resume();
      }
    };
    this.scene = new MyScene(root);
    this._addHook('resized', _resize);
    this._addHook('maximize', _resize);
    this._addHook('restore', _resize);
    this._addHook('minimize', _pause);
    this._addHook('restore', _resume);
    this._addHook('focus',   _resume);
    this._addHook('blur',     _pause);

    return root;
  };

  ApplicationThreejsWindow.prototype._inited = function() {
    Window.prototype._inited.apply(this, arguments);

    // Window has been successfully created and displayed.
    // You can start communications, handle files etc. here

    if ( this.scene ) {
      this.scene.init();
      this.scene.animate();
    }
  };

  ApplicationThreejsWindow.prototype.destroy = function() {
    // Destroy custom objects etc. here
    if ( this.scene ) {
      this.scene.destroy();
      this.scene = null;
    }

    Window.prototype.destroy.apply(this, arguments);
  };

  /////////////////////////////////////////////////////////////////////////////
  // APPLICATION
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Application constructor
   */
  var ApplicationThreejs = function(args, metadata) {
    Application.apply(this, ['ApplicationThreejs', args, metadata]);

    // You can set application variables here
  };

  ApplicationThreejs.prototype = Object.create(Application.prototype);

  ApplicationThreejs.prototype.destroy = function() {
    // Destroy communication, timers, objects etc. here

    return Application.prototype.destroy.apply(this, arguments);
  };

  ApplicationThreejs.prototype.init = function(core, settings, metadata) {
    var self = this;

    Application.prototype.init.apply(this, arguments);

    // Create your main window
    var mainWindow = this._addWindow(new ApplicationThreejsWindow(this, metadata));

    // Do other stuff here
  };

  ApplicationThreejs.prototype._onMessage = function(obj, msg, args) {
    Application.prototype._onMessage.apply(this, arguments);

    // Make sure we kill our application if main window was closed
    if ( msg == 'destroyWindow' && obj._name === 'ApplicationThreejsWindow' ) {
      this.destroy();
    }
  };

  //
  // EXPORTS
  //
  OSjs.Applications = OSjs.Applications || {};
  OSjs.Applications.ApplicationThreejs = ApplicationThreejs;

})(OSjs.Core.Application, OSjs.Core.Window, OSjs.GUI, OSjs.Dialogs);
