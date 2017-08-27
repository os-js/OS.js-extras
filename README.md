# OS.js Extra Packages

This repository contains *some* Extra packages for [OS.js](https://github.com/os-js/OS.js).

[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/os-js/OS.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)
[![Tips](https://img.shields.io/gratipay/os-js.svg)](https://gratipay.com/os-js/)
[![Donate](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=andersevenrud%40gmail%2ecom&lc=NO&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donate_SM%2egif%3aNonHosted)
[![Support](https://img.shields.io/badge/patreon-support-orange.svg)](https://www.patreon.com/user?u=2978551&ty=h&u=2978551)

```
./bin/add-package-repo.sh extras https://github.com/os-js/OS.js-extras.git
```

## GoogleMail and GoogleContacts

Google Mail and Contacts clients

![ScreenShot](https://raw.githubusercontent.com/os-js/OS.js-extras/master/doc/google.png)

*Will be moved to OS.js master branch when done*

You need to add your Google Client API ID. For more information look at [this article](https://manual.os-js.org/configuration/vfs) (Guide says VFS, but it relates to this as well).

## PDFjs

Read PDF documents.

Requires `gulp` to build.

![ScreenShot](https://raw.githubusercontent.com/os-js/OS.js-extras/master/doc/pdf.png)

## Ace Editor

A code editor.

![ScreenShot](https://raw.githubusercontent.com/os-js/OS.js-extras/master/doc/ace.png)

## Chat

A XMPP client for Google Talk. Includes proxy for Apache (See INSTALL file).

![ScreenShot](https://raw.githubusercontent.com/os-js/OS.js-extras/master/doc/chat.png)

Requires a twist server running on punjab and a HTTP proxy (Included in vendor files)

How to set up: https://github.com/os-js/OS.js-extras/blob/master/Chat/README.md

## VNC

A [noVNC](https://github.com/kanaka/noVNC) implementation.

![ScreenShot](https://raw.githubusercontent.com/os-js/OS.js-extras/master/doc/vnc.png)

Tested with OSX, Windows and Linux using *websockify* (included)

How to set up: https://github.com/kanaka/noVNC/wiki/Advanced-usage
