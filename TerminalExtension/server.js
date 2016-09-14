(function() {

  var pty = require('pty.js');
  var app = require('http').createServer(handler)
  var io = require('socket.io')(app);
  var fs = require('fs');
  var path = require('path');

  var sessions = {};
  var timeouts = {};

  var uid;
  var userinfo = {
    dir: process.env.HOME,
    shell: 'bash'
  };

  function createSession() {

    var term = pty.spawn('login', [], {
      name: 'xterm-color',
      uid: uid,
      cols: 80,
      rows: 30,
      cwd: userinfo.dir,
      env: process.env
    });

    term.on('data', function(data) {
      var id = term.pty;
      io.emit('data', id, data);
    });

    term.on('title', function(title) {
      var id = term.pty;
      io.emit('title', id, title);
    });

    term.on('close', function() {
      var id = term.pty;
      io.emit('kill', id);

      destroySession(id);
    });

    last = term;

    return term;
  }

  function handler(req, res) {
    fs.readFile(__dirname + '/index.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }

      res.writeHead(200);
      res.end(data);
    });
  }

  function destroySession(id) {
    if ( sessions[id] ) {
      console.log('!!! destroying session', id);
      if ( sessions[id].term ) {
        sessions[id].term.destroy();
      }
      delete sessions[id];
    }

    if ( timeouts[id] ) {
      timeouts[id] = clearInterval(timeouts[id]);
    }
  };

  setInterval(function() {
    Object.keys(sessions).forEach(function(key) {
      var term = sessions[key];
      if ( term.ping ) {
        var now = Date.now();
        var sec = (now - term.ping) / 1000;
        if ( sec >= 60 ) {
          console.log('Session', key, 'timed out');
          destroySession(key);
        }
      }
    });
  }, 1000);

  io.on('connection', function (socket) {
    console.log('Incoming connection');

    //io.emit('data', '...creating shell...');

    socket.on('resize', function(id, x, y) {
      if ( arguments.length === 2 ) return;
      console.log('<<<', 'resize', id, x, y);

      var term = sessions[id];
      if ( term ) {
        term.term.resize(x, y);
      }
    });

    socket.on('process', function(id, cb) {
      //console.log('<<<', 'process', id);

      var term = sessions[id];
      if ( term ) {
        cb(false, term.term.process);
      } else {
        cb(false, 'null');
      }
    });

    socket.on('data', function (id, data) {
      var term = sessions[id];
      if ( term ) {
        term.term.write(data);
      }
    });

    socket.on('destroy', function(id) {
      console.log('<<<', 'destroy', id);
      destroySession(id);
    });

    socket.on('spawn', function(cb) {
      var term = createSession();
      var id = term.pty;

      console.log('>>>', 'spawn', id);

      timeouts[id] = setInterval(function() {
        if ( sessions[id] ) {
          sessions[id].ping = Date.now();
        }
      }, 1000);

      sessions[id] = {
        ping: Date.now(),
        term: term
      };

      cb(id);
    });

  });

  if ( process.argv.length < 4 ) {
    throw 'You have to specify <port> and <uid>';
  }

  var port = process.argv[2];
  uid = parseInt(process.argv[3], 10);

  userinfo = require('pwuid')(uid);

  function exit() {
    Object.keys(sessions).forEach(function(key) {
      if ( key && sessions[key] ) {
        destroySession(key);
      }
    });
  }
  process.on('exit', function() {
    exit();
  });
  process.on('SIGINT', function() {
    exit();
    process.exit();
  });

  app.listen(port);

})();
