export const appStyles = String.raw`
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #20251f; background: #f3f5f0; font-synthesis: none; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; }
    button, input, textarea { font: inherit; }
    button { border: 0; border-radius: .65rem; padding: .72rem 1rem; background: #315c42; color: #fff; font-weight: 650; cursor: pointer; }
    button:hover { background: #244b34; }
    button:disabled { opacity: .55; cursor: wait; }
    button.secondary { color: #315c42; background: #e7eee5; }
    button.secondary:hover { background: #dce8da; }
    input, textarea { width: 100%; border: 1px solid #d5dcd2; border-radius: .6rem; padding: .72rem .8rem; color: inherit; background: white; outline-color: #6b9778; }
    label { display: grid; gap: .35rem; color: #636b61; font-size: .84rem; font-weight: 600; }
    .shell { width: min(100% - 2rem, 920px); margin: 0 auto; padding: 1.5rem 0 2rem; }
    .topbar { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; padding: .5rem 0 1rem; }
    .brand { display: flex; align-items: center; gap: .8rem; }
    .brand-mark { display: grid; place-items: center; width: 2.7rem; height: 2.7rem; border-radius: .9rem; background: #315c42; color: white; font-size: 1.3rem; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 1.35rem; letter-spacing: -.03em; }
    .brand p { margin-top: .2rem; color: #777f74; font-size: .9rem; }
    .room-controls { display: grid; grid-template-columns: minmax(110px, 150px) minmax(110px, 150px) auto; align-items: end; gap: .6rem; }
    .room-controls input { padding: .6rem .7rem; }
    .status { min-height: 1.5rem; color: #627067; font-size: .88rem; padding: .2rem 0 .65rem; }
    .card { border: 1px solid #e1e6de; border-radius: 1rem; background: white; box-shadow: 0 10px 32px #233a2410; }
    .mcp-panel { margin: 0 0 .8rem; border: 1px solid #e1e6de; border-radius: .8rem; background: #fff; padding: .8rem 1rem; }
    .mcp-panel summary { cursor: pointer; font-weight: 650; }
    .mcp-panel p { margin-top: .65rem; }
    .mcp-panel ul { margin: .4rem 0 0; padding-left: 1.2rem; }
    .chat { display: flex; min-height: min(70vh, 720px); flex-direction: column; overflow: hidden; }
    .messages { flex: 1; min-height: 320px; overflow-y: auto; padding: 1.2rem; }
    .empty { display: grid; place-items: center; min-height: 270px; text-align: center; color: #788176; }
    .empty strong { display: block; margin-bottom: .35rem; color: #343c34; font-size: 1.1rem; }
    .message { width: fit-content; max-width: min(82%, 680px); margin: 0 0 .8rem; border: 1px solid #e5e9e2; border-radius: .85rem; padding: .75rem .9rem; background: #f7f8f5; }
    .message.mine { margin-left: auto; background: #edf4ec; border-color: #dce9dc; }
    .message.agent { background: #f4f1e8; border-color: #ebe4d2; }
    .message.system { width: 100%; max-width: 100%; background: #fafafa; color: #60685f; border-style: dashed; }
    .message.streaming { border-color: #7ca58a; }
    .byline { margin-bottom: .35rem; color: #697267; font-size: .76rem; font-weight: 700; }
    .message-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
    .progress { padding: .6rem 1.2rem; border-top: 1px solid #edf0ea; color: #647067; font-size: .82rem; }
    .progress ul { margin: .35rem 0 0; padding-left: 1.1rem; }
    .composer { border-top: 1px solid #edf0ea; padding: .8rem; }
    .composer textarea { min-height: 78px; resize: vertical; border-color: transparent; background: #f7f8f5; }
    .composer-footer { display: flex; justify-content: space-between; align-items: center; gap: .8rem; padding: .5rem .1rem 0; }
    .actions { display: flex; gap: .5rem; }
    .muted { color: #798176; font-size: .84rem; }
    .error { min-height: 1.3rem; padding: 0 .9rem .5rem; color: #a33e35; font-size: .85rem; }
    .footer { padding: .9rem .2rem 0; color: #80877e; text-align: center; font-size: .8rem; }
    .hidden, .sr-only { display: none !important; }
    code { border-radius: .25rem; padding: .1rem .25rem; background: #f0f2ed; }
    @media (max-width: 700px) {
      .shell { width: min(100% - 1rem, 920px); padding-top: .8rem; }
      .topbar { align-items: stretch; flex-direction: column; gap: 1rem; }
      .room-controls { grid-template-columns: 1fr 1fr; }
      .room-controls button { grid-column: span 2; }
      .chat { min-height: 72vh; }
      .messages { padding: .8rem; }
      .message { max-width: 92%; }
      .composer-footer { align-items: stretch; flex-direction: column; }
      .actions button { flex: 1; }
    }
`;
