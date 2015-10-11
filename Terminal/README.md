# PTY Terminal Application

This shows you how to set up the PTY/SSH terminal.

**Please mind that this is experimental**.

**It takes the client username and uses it on the server, so your username has to match a system user**

## Server

In `TerminalExtension`:

```

npm install
node src/packages/extras/TerminalExtension/spawner.js

```

**The spawner must run with root privileges to spawn with correct uid**

## Client


In `TerminalExtension/package.json`:
```

{
  ...
  "enabled": true
  ...
}

```



In `Terminal/package.json`:

```

{
  ...
  "enabled": true,
  "config": {
    "host": "YOUR.IP.ADDRESS.HERE:8080"
  },
  ...
}

```

Run `grunt config manifest`.
