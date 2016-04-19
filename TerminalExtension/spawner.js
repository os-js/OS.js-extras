(function() {
  var portRange = [26490, 26999];
  var portIndex = portRange[0];
  var serverPort= 8080;
  var instances = {};

  var fs = require('fs');
  var path = require('path');
  var userid = require('userid');
  var spawn = require('child_process').spawn;
  var app = require('http').createServer(handler);
  var io = require('socket.io')(app);

  var out = fs.openSync('/tmp/out.log', 'a');
  var err = fs.openSync('/tmp/out.log', 'a');

  console.log('Opening spawner on', serverPort);
  console.log('Client ranges', portRange);

  function exit() {
    Object.keys(instances).forEach(function(key) {
      if ( key && instances[key] ) {
        killInstance(key);
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

  app.listen(serverPort);

  function handler() {
  }

  function spawnInstance(uid, socket) {
    var p = path.join(__dirname, 'server.js');
    var child = spawn('node', [p, portIndex, uid], {
      //uid: uid,
      detached: true,
      stdio: [ 'ignore', out, err ]
    });

    console.log('---', 'Created instance pid', child.pid, '@', portIndex, 'on user', uid);

    portIndex++;

    return {child: child, port: portIndex-1};
  }

  function killInstance(pid) {
    if ( pid && instances[pid] ) {
      console.log('!!!', 'Killing instance', pid);
      if ( instances[pid].child ) {
        instances[pid].child.kill('SIGHUP');
      }
      if ( instances[pid].socket ) {
        instances[pid].socket.disconnect();
      }

      delete instances[pid];
    }
  }

  setInterval(function() {
    Object.keys(instances).forEach(function(key) {
      if ( instances[key] && instances[key].socket ) {
        if ( !instances[key].socket.connected ) {
          console.log('Cleaning up instance', key);
          killInstance(key);
        }
      }
    });
  }, 5000);

  io.on('connection', function(socket) {
    console.log('Connection incoming');

    socket.on('spawn', function(username, cb) {
      var uid = null;

      /*
      console.log('  ->', 'username', username);

      try {
        if ( typeof username === 'number' ) {
          if ( userid.username(username) ) {
            uid = username;
          }
        } else {
          uid = userid.uid(username);
        }
      } catch ( e ) {
        socket.emit('warning', 'invalid user');
        console.warn('!!!', 'Invalid user', username);
        return;
      }

      console.log('  -->', 'uid', uid);
      if ( uid === null ) {
        socket.emit('warning', 'invalid user');
        console.warn('!!!', 'User not found', username);
        return;
      }
      */

      var child = spawnInstance(uid, socket);
      instances[child.child.pid] = {
        child: child.child,
        socket: socket
      };

      cb(child.child.pid, child.port);
    });

    socket.on('kill', function(pid) {
      console.log('  ->', 'kill', pid);
      killInstance(pid);
    });

  });

})();
