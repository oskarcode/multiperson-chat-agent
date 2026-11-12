import { DEFAULT_WORKERS_AI_MODEL } from "../agent/models";
import { appClientScript } from "./client-script";
import { appPage } from "./page";
import { appStyles } from "./styles";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function displayModelName(modelId: string): string {
  const slug = modelId.trim().split("/").filter(Boolean).at(-1) || modelId.trim();
  const words = slug.replace(/[-_]+/gu, " ").replace(/\s+/gu, " ").trim();
  return words.replace(/^glm\b/iu, "GLM").replace(/^[a-z]/u, (letter) => letter.toUpperCase());
}

export function appHtml(configuredModel?: string): string {
  const modelId = configuredModel?.trim() || DEFAULT_WORKERS_AI_MODEL;
  const modelName = escapeHtml(displayModelName(modelId));
  const escapedModelId = escapeHtml(modelId);
  return String.raw`<!doctype html>
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
${appPage(modelName, escapedModelId)}
  <script type="module">
${appClientScript}
  </script>
</body>
</html>`;
}
