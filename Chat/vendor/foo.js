<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta name="generator" content=
  "HTML Tidy for Linux/x86 (vers 25 March 2009), see www.w3.org" />

  <title>Browser-to-Browser Private Text Chat &#174; Muaz Khan</title>
  <meta http-equiv="Content-Type" content="text/html; charset=us-ascii" />
  <meta charset="utf-8" />
  <meta name="viewport" content=
  "width=device-width, initial-scale=1.0, user-scalable=no" />
  <link rel="author" type="text/html" href=
  "https://plus.google.com/100325991024054712503" />
  <meta name="author" content="Muaz Khan" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
  <script type="text/javascript">
//<![CDATA[
  (function () {
      var params = {}, r = /([^&=]+)=?([^&]*)/g;

      function d(s) {
          return decodeURIComponent(s.replace(/\+/g, ' '));
      }
      var match, search = window.location.search.toLowerCase();
      while (match = r.exec(search.substring(1))) params[d(match[1])] = d(match[2]);
      window.params = params;
  })();
  var params = window.params;
  if (!params.privateroom) location.href = location.href + '?privateRoom=' + Math.round(Math.random() * 60535) + 5000;
  //]]>
  </script>
  <style type="text/css">
/*<![CDATA[*/
  @import url(https://fonts.googleapis.com/css?family=Inconsolata);html {background: #eee;}body {font-family: "Inconsolata", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", monospace;font-size: 1.2em;line-height: 1.2em;margin: 0;}article, footer {display: block;max-width: 900px;min-width: 360px;width: 80%;}article {background: #fff;border: 1px solid;border-color: #ddd #aaa #aaa #ddd;margin: 2.5em auto 0 auto;padding: 2em;}h1 {margin-top: 0;}article p:first-of-type {margin-top: 1.6em;}article p:last-child {margin-bottom: 0;}footer {margin: 0 auto 2em auto;text-align: center;}footer a {color: #666;font-size: inherit;padding: 1em;text-decoration: none;text-shadow: 0 1px 1px #fff;}footer a:hover, footer a:focus {color: #111;}h1, h2 {border-bottom: 1px solid black;display: inline;font-weight: normal;line-height: 36px;padding: 0 0 3px 0;}a {color: #2844FA;text-decoration: none;}a:hover, a:focus {color: #1B29A4;}a:active {color: #000;}:-moz-any-link:focus {border: 0;color: #000;}::selection {background: #ccc;}::-moz-selection {background: #ccc;}button, select {-moz-border-radius: 3px;-moz-transition: none;-webkit-transition: none;background: #0370ea;background: -moz-linear-gradient(top, #008dfd 0, #0370ea 100%);background: -webkit-linear-gradient(top, #008dfd 0, #0370ea 100%);border: 1px solid #076bd2;border-radius: 3px;color: #fff;display: inline-block;font-family: inherit;font-size: .8em;line-height: 1.3;padding: 5px 12px;text-align: center;text-shadow: 1px 1px 1px #076bd2;}button:hover {background: rgb(9, 147, 240);}button:active {background: rgb(10, 118, 190);}button[disabled] {background: none;border: 1px solid rgb(187, 181, 181);color: gray;text-shadow: none;}strong {color: rgb(204, 14, 14);font-family: inherit;font-weight: normal;}select {color: black;text-shadow: none;}td {vertical-align: top;}#chat-output div, #file-progress div {border: 1px solid black;border-bottom: 0;padding: .1em .4em;}input {border: 1px solid black;font-family: inherit;margin: .1em .3em;outline: none;padding: .1em .2em;width: 97%;}#chat-output, #file-progress {margin: 0 0 0 .4em;max-height: 12em;overflow: auto;}pre {border-left: 2px solid red;margin-left: 2em;padding-left: 1em;}section.user-id {float: left;overflow: hidden;padding-left: 0;padding-right: 1em;width: 5em;text-align: right;}section.message {border-left: 1px solid #CCCCCC;margin-left: 4em;overflow: hidden;padding-left: 1em;}
  /*]]>*/
  </style><!-- for HTML5 el styling -->
  <script type="text/javascript">
//<![CDATA[
  document.createElement('article');document.createElement('footer');
  //]]>
  </script>
  <script src="https://webrtc-experiment.appspot.com/DataChannel.js" type=
  "text/javascript">
</script>
  <script src="https://webrtc-experiment.appspot.com/firebase.js" type="text/javascript">
</script>
</head>

<body>
  <h1>Browser-to-Browser <span style="color:red">Private Text Chat</span> + File
  Sharing</h1>

  <p><span>Copyright &#169; 2013</span> <a href="https://github.com/muaz-khan" target=
  "_blank">Muaz Khan</a><span>&lt;</span><a href="http://twitter.com/muazkh" target=
  "_blank">@muazkh</a><span>&gt;.</span></p>

  <div class="g-plusone" data-href="https://webrtc-experiment.appspot.com/"></div>

  <h2>Share <a id="share-link" href="/privatechat/" target="_blank">this private link</a>
  with your friends.</h2>

  <table style="border-left: 1px solid black; width: 100%;">
    <tr>
      <td>
        <h2 style="display: block; font-size: 1em; text-align: center;">Text Chat</h2>

        <div id="chat-output"></div><input type="text" id="user-id" style=
        "font-size: 1.2em;width: 5em;margin-right: 0;" placeholder="all" disabled=
        "disabled" title="Enter user-id to send direct messages." /><input type="text"
        id="chat-input" style="font-size: 1.2em;width: 20em;margin-left: -.5em;"
        placeholder="chat message" disabled="disabled" />
      </td>

      <td style="background: white; border-left: 1px solid black;">
        <h2 style="display: block; font-size: 1em; text-align: center;">Share
        Files</h2><input type="file" id="file" disabled="disabled" />

        <div id="file-progress"></div>
      </td>
    </tr>
  </table><script type="text/javascript">
//<![CDATA[
  document.getElementById('share-link').href = '/privatechat/?privateRoom=' + params.privateroom;
  window.username = prompt('Enter your username') || Math.round(Math.random() * 60535) + 5000;
  var channel = new DataChannel(params.privateroom, {
      firebase: 'muazkh',
      userid: username
  });
  channel.onmessage = function (data, userid) {
      console.debug(userid, 'posted', data);
      appendDIV(data, userid);
  };
  channel.onopen = function () {
      if (document.getElementById('chat-input')) document.getElementById('chat-input').disabled = false;
      if (document.getElementById('file')) document.getElementById('file').disabled = false;
      if (useridBox) useridBox.disabled = false;
  };
  channel.onFileProgress = function (packets) {
      appendDIV(packets.remaining + ' packets remaining.', 'file', fileProgress);
      if (packets.sent) appendDIV(packets.sent + ' packets sent.', 'file', fileProgress);
      if (packets.received) appendDIV(packets.received + ' packets received.', 'file', fileProgress);
  };
  channel.onFileSent = function (file) {
      appendDIV(file.name + ' sent.', 'file', fileProgress);
  };
  channel.onFileReceived = function (fileName) {
      appendDIV(fileName + ' received.', 'file', fileProgress);
  };
  document.getElementById('file').onchange = function () {
      var file = this.files[0];
      channel.send(file);
  };
  var chatOutput = document.getElementById('chat-output'),
      fileProgress = document.getElementById('file-progress');

  function appendDIV(data, userid, parent) {
      var div = document.createElement('div');
      if (parent) div.innerHTML = data;
      else {
          div.innerHTML = '<section class="user-id" contenteditable title="Use his user-id to send him direct messages or throw out of the room!">' + userid + '<\/section>' + '<section class="message" contenteditable>' + data + '<\/section>';
      } if (!parent) chatOutput.insertBefore(div, chatOutput.firstChild);
      else parent.insertBefore(div, parent.firstChild);
      div.tabIndex = 0;
      div.focus();
      chatInput.focus();
  }
  var chatInput = document.getElementById('chat-input');
  var useridBox = document.getElementById('user-id');
  chatInput.onkeypress = function (e) {
      if (e.keyCode !== 13 || !this.value) return;
      if (useridBox.value.length) {
          var user = channel.channels[useridBox.value];
          if (user) user.send(this.value);
          else return alert('No such user exists.');
      } else channel.send(this.value);
      appendDIV(this.value, 'Me');
      this.value = '';
      this.focus();
  }; /* users presence detection */
  channel.onleave = function (userid) {
      appendDIV('Bye. I am going away.', userid);
  };
  //]]>
  </script><br />
  <br />
  <br />
  <br />
  You can share files of any size, too!<br />
  <br />

  <h2>Is it really private?</h2><br />
  If you're using chrome or firefox:

  <ol>
    <li>Yeah, It is 100% browser-to-browser &lt;private&gt; text chat.</li>

    <li>Nothing is saved on the server; it is guaranteed.</li>

    <li>This application sends text or file directly to your friends. There is "NO"
    middle server here. It is 100% direct text chat.</li>

    <li>This application is using WebRTC DataChannel APIs to open SCTP data ports
    directly between two or more browsers. Those data ports are direct
    [browser-to-browser]. Server has no-knowledge of those ports. Best secure ports like
    DTLS are used to privatelytravel your text messages and files between you and your
    friends.</li>

    <li>Unlimited users can join your privately shared chatting room.</li>
  </ol><br />
  <br />

  <h2 id="feedback" style=
  "padding: .2em .4em; border-bottom: 1px solid rgb(189, 189, 189);">Feedback</h2>

  <div>
    <textarea id="message" style=
    "height: 8em; margin: .2em; width: 98%; border: 1px solid rgb(189, 189, 189); outline: none; resize: vertical;"
    placeholder="Have any message? Suggestions or something went wrong?">
</textarea>
  </div><button id="send-message" style="font-size: 1em;">Send Message</button>

  <p>This chat-application is developed using <a href=
  "https://github.com/muaz-khan/WebRTC-Experiment/tree/master/DataChannel" target=
  "_blank">DataChannel.js</a> library!</p><script src=
  "https://webrtc-experiment.appspot.com/common.js" type="text/javascript">
</script>
</body>
</html>

