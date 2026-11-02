// MCP OAuth runs in a popup; this response sends a small postMessage result back
// to the opener and uses a nonce-based CSP so no inline script is broadly allowed.
export const popupResult = (origin: string, ok: boolean, message: string): Response => {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const payload = JSON.stringify({ type: "multiperson-chat:mcp-oauth", ok, message });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MCP authorization</title></head><body><p>${message}</p><script nonce="${nonce}">window.opener?.postMessage(${payload}, ${JSON.stringify(origin)});window.close();</script></body></html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
};
