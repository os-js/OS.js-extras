#!/bin/bash
if [ ! -f "vendor/ace/build/src/ace.js" ]; then
  pushd vendor/ace
  npm install
  node ./Makefile.dryice.js
  popd
fi

