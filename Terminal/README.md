# PTY Terminal Application

This shows you how to set up the PTY/SSH terminal.

**Please mind that this is experimental**.

**It takes the client username and uses it on the server, so your username has to match a system user**

If you get this error then pty.js probably crashed. I'm looking at replacing it with another library.

```
Error creating PTY session { Error: read EIO
  at exports._errnoException (util.js:1024:11)
  at Pipe.onread (net.js:610:25) code: 'EIO', errno: 'EIO', syscall: 'read' }
```

## Install dependencies

Make sure your system has `bash` installed.

## Configure

In `metadata.json` you can change to a custom location (by default it will use the hostname from URL on port 8080)

```
{
  ...
  "config": {
    "host": "YOUR.IP.ADDRESS.HERE:8080"
  },
  ...
}
```

### Running spawner

Enabling in `metadata.json` only allows to spawn terminals under the user OS.js server runs as. At the moment there is no system service, so you can launch it manually:

`node spawner.js`
