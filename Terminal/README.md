# PTY Terminal

This shows you how to set up the PTY/SSH terminal. **Please mind that this is experimental**.


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
    "host": "YOUR.IP.ADDRESS.HERE:PORT"
  },
  ...
}

```

Run `grunt config manifest`, then `node src/packages/extras/TerminalExtension/server.js`
