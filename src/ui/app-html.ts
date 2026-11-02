import { appClientScript } from "./client-script";
import { appPage } from "./page";
import { appStyles } from "./styles";

export const appHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MultiPerson Chat</title>
  <meta name="referrer" content="no-referrer" />
  <style>
${appStyles}
  </style>
</head>
<body>
${appPage}
  <script type="module">
${appClientScript}
  </script>
</body>
</html>`;
