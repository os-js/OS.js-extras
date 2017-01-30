#!/bin/bash
if [ ! -f "vendor/pdf.js/build/pdf.js" ]; then
  pushd vendor/pdf.js
  npm install
  gulp generic
  popd
fi

