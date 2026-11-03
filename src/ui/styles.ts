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
    button.danger { background: #a33e35; }
    button.danger:hover { background: #862f28; }
    input, textarea { width: 100%; border: 1px solid #d5dcd2; border-radius: .6rem; padding: .72rem .8rem; color: inherit; background: white; outline-color: #6b9778; }
    label { display: grid; gap: .35rem; color: #636b61; font-size: .84rem; font-weight: 600; }
    .shell { width: min(100% - 2rem, 920px); margin: 0 auto; padding: 1.5rem 0 2rem; }
    .workspace-shell { display: grid; grid-template-columns: 280px minmax(0, 1fr); width: 100%; height: 100dvh; min-height: 0; margin: 0; padding: 0; }
    .workspace-sidebar { display: flex; min-width: 0; flex-direction: column; gap: 1rem; overflow-y: auto; border-right: 1px solid #e1e6de; padding: 1.2rem; background: #fafbf9; }
    .workspace-sidebar .topbar { justify-content: flex-start; align-items: flex-start; padding: 0; }
    .workspace-sidebar .brand { align-items: flex-start; }
    .workspace-sidebar .brand > div { min-width: 0; }
    .workspace-sidebar .brand h1 { overflow-wrap: anywhere; }
    .workspace-sidebar .guest-controls { display: grid; align-items: stretch; gap: .45rem; }
    .workspace-sidebar .guest-controls label { min-width: 0; }
    .workspace-sidebar .guest-controls .muted { font-size: .78rem; line-height: 1.4; }
    .workspace-sidebar .mcp-panel { margin: 0; padding: .8rem; }
    .workspace-sidebar .mcp-panel[open] { max-height: 45vh; overflow-y: auto; }
    .sidebar-footer { margin-top: auto; border-top: 1px solid #e1e6de; padding-top: 1rem; color: #80877e; font-size: .8rem; line-height: 1.5; }
    .sidebar-footer a { color: #315c42; font-weight: 650; }
    .workspace-main { display: flex; min-width: 0; min-height: 0; flex-direction: column; gap: .5rem; padding: 1rem; }
    .workspace-main .status { flex: 0 0 auto; margin: 0; }
    .topbar { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; padding: .5rem 0 1rem; }
    .brand { display: flex; align-items: center; gap: .8rem; }
    .brand-mark { display: grid; place-items: center; width: 2.7rem; height: 2.7rem; border-radius: .9rem; background: #315c42; color: white; font-size: 1.3rem; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 1.35rem; letter-spacing: -.03em; }
    .brand p { margin-top: .2rem; color: #777f74; font-size: .9rem; }
    .guest-controls { display: flex; align-items: end; gap: .7rem; }
    .guest-controls label { min-width: 150px; }
    .guest-controls input { padding: .6rem .7rem; }
    .status { min-height: 1.5rem; color: #627067; font-size: .88rem; padding: .2rem 0 .65rem; }
    .card { border: 1px solid #e1e6de; border-radius: 1rem; background: white; box-shadow: 0 10px 32px #233a2410; }
    .mcp-panel { margin: 0 0 .8rem; border: 1px solid #e1e6de; border-radius: .8rem; background: #fff; padding: .8rem 1rem; }
    .mcp-panel summary { cursor: pointer; font-weight: 650; }
    .mcp-panel p { margin-top: .65rem; }
    .mcp-panel ul { margin: .4rem 0 0; padding-left: 1.2rem; }
    .chat { display: flex; min-height: min(70vh, 720px); flex-direction: column; overflow: hidden; }
    .workspace-main .chat { flex: 1; min-height: 0; }
    .messages { flex: 1; min-height: 320px; overflow-y: auto; padding: 1.2rem; }
    .workspace-main .messages { min-height: 0; }
    .empty { display: grid; place-items: center; min-height: 270px; text-align: center; color: #788176; }
    .empty strong { display: block; margin-bottom: .35rem; color: #343c34; font-size: 1.1rem; }
    .message { width: fit-content; max-width: min(82%, 680px); margin: 0 0 .8rem; border: 1px solid #e5e9e2; border-radius: .85rem; padding: .75rem .9rem; background: #f7f8f5; }
    .message.mine { margin-left: auto; background: #edf4ec; border-color: #dce9dc; }
    .message.agent { max-width: min(94%, 780px); background: #fff; border-color: #e6e9e3; box-shadow: 0 2px 8px #233a2408; }
    .message.system { width: 100%; max-width: 100%; background: #fafafa; color: #60685f; border-style: dashed; }
    .message.streaming { border-color: #7ca58a; }
    .byline { margin-bottom: .35rem; color: #697267; font-size: .76rem; font-weight: 700; }
    .message-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; }
    .message-text.markdown { white-space: normal; line-height: 1.65; }
    .message-text p { margin: 0; }
    .message-text p + p { margin-top: .75em; }
    .message-text ul, .message-text ol { margin: .45em 0 .65em; padding-left: 1.35em; }
    .message-text li + li { margin-top: .2em; }
    .message-text h1, .message-text h2, .message-text h3 { margin: .8em 0 .35em; line-height: 1.3; }
    .message-text h1 { font-size: 1.2em; }
    .message-text h2 { font-size: 1.1em; }
    .message-text h3 { font-size: 1em; }
    .message-text blockquote { margin: .5em 0; border-left: 3px solid #cbd8ca; padding-left: .8em; color: #5f6b5e; }
    .message-text pre { overflow-x: auto; margin: .65em 0; border-radius: .6em; padding: .8em; background: #202a22; color: #f3f6f2; }
    .message-text pre code { display: block; padding: 0; background: transparent; color: inherit; }
    .message-text a { color: #315c42; text-decoration-thickness: 1px; text-underline-offset: 2px; }
    .activity-panel { border-top: 1px solid #edf0ea; background: #fbfcfa; }
    .activity-panel summary { cursor: pointer; padding: .7rem 1.2rem; color: #465247; font-size: .84rem; font-weight: 700; }
    .activity-panel summary .muted { margin-left: .45rem; font-weight: 400; }
    .progress { padding: 0 1.2rem .8rem; color: #647067; font-size: .82rem; }
    .progress .activity-current { color: #344638; font-weight: 650; }
    .progress .activity-events { display: grid; gap: .3rem; margin: .45rem 0 0; padding-left: 1.2rem; }
    .progress .activity-events li { padding-left: .1rem; }
    .admin-shell { width: min(100% - 2rem, 760px); margin: 0 auto; padding: 2rem 0; }
    .admin-header, .admin-section { margin-bottom: 1rem; }
    .admin-section { padding: 1.1rem; }
    .admin-section h2 { margin-bottom: .75rem; font-size: 1.05rem; }
    .admin-form { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: .65rem; }
    .admin-form .wide { grid-column: 1 / -1; }
    .admin-list { display: grid; gap: .65rem; margin: .8rem 0 0; padding: 0; list-style: none; }
    .admin-item { display: flex; align-items: center; justify-content: space-between; gap: .8rem; border: 1px solid #e5e9e2; border-radius: .7rem; padding: .75rem; overflow-wrap: anywhere; }
    .admin-item a { color: #315c42; font-weight: 650; }
    .admin-item-actions { display: flex; flex-wrap: wrap; gap: .4rem; }
    .admin-status { min-height: 1.4rem; margin-top: .6rem; color: #667067; font-size: .85rem; }
    .admin-error { color: #a33e35; }
    .admin-tools { margin: .5rem 0 0; padding-left: 1.2rem; color: #5b665c; font-size: .87rem; }
    .composer { border-top: 1px solid #edf0ea; padding: .8rem; }
    .composer textarea { min-height: 78px; resize: vertical; border-color: transparent; background: #f7f8f5; }
    .composer-footer { display: flex; justify-content: space-between; align-items: center; gap: .8rem; padding: .5rem .1rem 0; }
    .actions { display: flex; gap: .5rem; }
    .muted { color: #798176; font-size: .84rem; }
    .error { min-height: 1.3rem; padding: 0 .9rem .5rem; color: #a33e35; font-size: .85rem; }
    .footer { padding: .9rem .2rem 0; color: #80877e; text-align: center; font-size: .8rem; }
    .hidden, .sr-only { display: none !important; }
    code { border-radius: .25rem; padding: .1rem .25rem; background: #f0f2ed; }
    @media (max-width: 760px) {
      .shell { width: min(100% - 1rem, 920px); padding-top: .8rem; }
      .workspace-shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100dvh; }
      .workspace-sidebar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(130px, min(40vw, 180px)); grid-template-rows: auto auto; gap: .55rem .7rem; overflow: visible; border-right: 0; border-bottom: 1px solid #e1e6de; padding: .6rem .7rem; }
      .workspace-sidebar .topbar { grid-column: 1; grid-row: 1; align-items: center; flex-direction: row; gap: .4rem; }
      .workspace-sidebar .brand { align-items: center; gap: .55rem; }
      .workspace-sidebar .brand-mark { width: 2.2rem; height: 2.2rem; font-size: 1.05rem; }
      .workspace-sidebar .brand p { display: none; }
      .workspace-sidebar .brand h1 { overflow: hidden; max-width: 100%; font-size: 1.05rem; text-overflow: ellipsis; white-space: nowrap; }
      .workspace-sidebar .guest-controls { grid-column: 2; grid-row: 1; display: block; align-self: center; }
      .workspace-sidebar .guest-controls label { min-width: 0; gap: .15rem; font-size: .72rem; }
      .workspace-sidebar .guest-controls input { padding: .4rem .55rem; }
      .workspace-sidebar .guest-controls span { display: none; }
      .workspace-sidebar .mcp-panel { grid-column: 1 / -1; grid-row: 2; padding: .45rem .65rem; }
      .workspace-sidebar .mcp-panel[open] { max-height: 22vh; }
      .sidebar-footer { display: none; }
      .workspace-main { gap: .15rem; padding: .4rem .55rem .55rem; }
      .workspace-main .status { min-height: 1.2rem; padding: 0 .1rem .2rem; font-size: .76rem; }
      .workspace-main .chat { min-height: 0; }
      .workspace-main .messages { min-height: 0; padding: .8rem; }
      .admin-form { grid-template-columns: 1fr; }
      .admin-form .wide { grid-column: auto; }
      .admin-item { align-items: stretch; flex-direction: column; }
      .admin-item-actions button { flex: 1; }
      .message { max-width: 92%; }
      .composer-footer { align-items: stretch; flex-direction: column; }
      .actions button { flex: 1; }
    }
`;
