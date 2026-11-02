import { adminClientScript } from "./admin-client-script";
import { adminPage } from "./admin-page";
import { appStyles } from "./styles";

export const adminHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Workspace admin · MultiPerson Chat</title>
  <meta name="referrer" content="no-referrer" />
  <style>${appStyles}</style>
</head>
<body>
${adminPage}
  <script type="module">
${adminClientScript}
  </script>
</body>
</html>`;
