export const appStyles = String.raw`
  :root {
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #202820;
    background: #f2f4f1;
    font-synthesis: none;
    --ink: #202820;
    --muted: #778078;
    --line: #e5e9e4;
    --surface: #fff;
    --canvas: #f2f4f1;
    --green: #276448;
    --green-dark: #1e5138;
    --green-soft: #edf5ef;
    --shadow: 0 18px 48px rgb(29 46 33 / 7%), 0 2px 8px rgb(29 46 33 / 3%);
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: radial-gradient(ellipse at 12% 0%, #f8faf7 0, transparent 38%), var(--canvas); }
  button, input, textarea { font: inherit; }
  button { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; min-height: 2.65rem; border: 1px solid var(--green); border-radius: .75rem; padding: .68rem .95rem; background: var(--green); color: white; font-size: .86rem; font-weight: 650; cursor: pointer; transition: background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease; }
  button:hover:not(:disabled) { border-color: var(--green-dark); background: var(--green-dark); box-shadow: 0 4px 12px rgb(30 81 56 / 14%); transform: translateY(-1px); }
  button:active:not(:disabled) { transform: translateY(0); }
  button:disabled { opacity: .52; cursor: wait; }
  button.secondary { border-color: #dce6de; background: #f6f9f6; color: #315b43; }
  button.secondary:hover:not(:disabled) { border-color: #c7d9ca; background: #edf4ee; box-shadow: none; }
  button.danger { border-color: #f0d7d3; background: #fff5f3; color: #a43e34; }
  button.danger:hover:not(:disabled) { border-color: #e9bdb6; background: #fce9e6; box-shadow: none; }
  input, textarea { width: 100%; border: 1px solid #dce3dd; border-radius: .7rem; padding: .75rem .85rem; color: var(--ink); background: white; outline: 0; transition: border-color .16s ease, box-shadow .16s ease; }
  input:focus, textarea:focus { border-color: #78a78b; box-shadow: 0 0 0 3px rgb(74 137 97 / 12%); }
  input::placeholder, textarea::placeholder { color: #a0a8a1; }
  label { display: grid; gap: .4rem; color: #525d54; font-size: .82rem; font-weight: 650; }
  a { color: var(--green); text-decoration: none; }
  a:hover { text-decoration: underline; text-underline-offset: 3px; }
  h1, h2, h3, p { margin: 0; }
  .eyebrow { color: #849087; font-size: .66rem; font-weight: 750; letter-spacing: .12em; line-height: 1.35; text-transform: uppercase; }
  .muted { color: var(--muted); font-size: .8rem; line-height: 1.55; }
  .hidden, .sr-only { display: none !important; }
  .workspace-shell { display: grid; grid-template-columns: 264px minmax(0, 1fr); gap: 14px; width: min(100%, 1600px); height: 100dvh; min-height: 0; margin: 0 auto; padding: 16px; }
  .workspace-sidebar { display: flex; min-width: 0; min-height: 0; flex-direction: column; gap: 0; overflow: hidden auto; border: 1px solid #e7ebe6; border-radius: 22px; padding: 20px 16px 14px; background: rgb(255 255 255 / 94%); box-shadow: var(--shadow); }
  .brand { display: flex; align-items: center; gap: .7rem; color: inherit; text-decoration: none; }
  .brand:hover { text-decoration: none; }
  .brand-mark { display: grid; flex: 0 0 auto; place-items: center; width: 2.35rem; height: 2.35rem; border: 1px solid #d9e8dc; border-radius: .8rem; background: linear-gradient(145deg, #f3f8f3, #e8f1e9); color: var(--green); font-size: 1.18rem; }
  .brand-copy { display: grid; gap: .12rem; }
  .brand-name { color: #354239; font-size: .79rem; font-weight: 800; letter-spacing: .11em; }
  .brand-caption { color: #939b94; font-size: .71rem; }
  .sidebar-block { border-bottom: 1px solid #edf0ec; padding: 22px 2px 18px; }
  .workspace-card h1 { overflow-wrap: anywhere; margin-top: .55rem; font-size: 1.13rem; font-weight: 720; letter-spacing: -.035em; line-height: 1.28; }
  .access-note { display: flex; align-items: center; gap: .42rem; margin-top: .85rem; color: #68766c; font-size: .7rem; line-height: 1.4; }
  .access-icon { display: grid; flex: 0 0 auto; place-items: center; width: 1.2rem; height: 1.2rem; border-radius: 50%; background: #eff5ef; color: var(--green); font-size: .74rem; }
  .profile-block { padding-top: 18px; }
  .profile-field { display: flex; align-items: center; gap: .6rem; margin-top: .7rem; }
  .profile-field input { min-width: 0; border-color: transparent; padding: .55rem .15rem; background: transparent; font-size: .84rem; }
  .profile-field input:focus { border-color: #c9ddcd; background: #fbfdfb; box-shadow: 0 0 0 3px rgb(74 137 97 / 8%); }
  .profile-avatar, .speaker-avatar { display: grid; flex: 0 0 auto; place-items: center; border-radius: 50%; font-weight: 720; }
  .profile-avatar { width: 2rem; height: 2rem; border: 1px solid #dce6dd; background: #f0f5f0; color: #57715d; font-size: .72rem; }
  .field-hint { margin: .12rem 0 0 2.6rem; color: #97a099; font-size: .68rem; line-height: 1.45; }
  .mcp-panel { margin-top: 14px; border: 1px solid #e9ede9; border-radius: 13px; background: #fbfcfb; }
  .mcp-panel summary { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-height: 46px; padding: .55rem .65rem; color: #465248; cursor: pointer; font-size: .77rem; font-weight: 680; list-style: none; }
  .mcp-panel summary::-webkit-details-marker { display: none; }
  .mcp-summary-title { display: inline-flex; align-items: center; gap: .5rem; }
  .mcp-icon { display: grid; place-items: center; width: 1.45rem; height: 1.45rem; border: 1px solid #e1e8e2; border-radius: .45rem; background: white; color: #647d69; font-size: .78rem; }
  .tool-status { border: 1px solid #e5eae5; border-radius: 99px; padding: .2rem .42rem; color: #828c83; background: white; font-size: .63rem; font-weight: 600; white-space: nowrap; }
  .mcp-content { padding: 0 .7rem .75rem; }
  .mcp-content .muted { font-size: .73rem; }
  .text-button { min-height: auto; margin-top: .6rem; border: 0; border-radius: 0; padding: 0; background: transparent; color: var(--green); font-size: .73rem; font-weight: 700; }
  .text-button:hover:not(:disabled) { background: transparent; box-shadow: none; text-decoration: underline; transform: none; }
  .mcp-status-copy { margin-top: .5rem; color: #79847b; font-size: .69rem; line-height: 1.45; overflow-wrap: anywhere; }
  .mcp-tools { display: grid; gap: .35rem; max-height: 26vh; overflow: auto; margin: .5rem 0 0; padding: 0; list-style: none; }
  .mcp-tools > li { border-top: 1px solid #edf0ed; padding: .5rem 0 0; color: #606c62; font-size: .69rem; line-height: 1.45; overflow-wrap: anywhere; }
  .mcp-server-group { display: grid; gap: .25rem; }
  .mcp-server-heading { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; color: #526451; }
  .mcp-server-heading strong { font-size: .71rem; }
  .mcp-server-heading span, .mcp-server-error { color: #939b94; font-size: .64rem; }
  .mcp-server-error { margin: 0; color: #a46c5b; }
  .mcp-server-tool-list { display: grid; gap: .3rem; margin: .18rem 0 .2rem; padding: 0; list-style: none; }
  .mcp-server-tool-list li { color: #78827a; font-size: .65rem; line-height: 1.4; overflow-wrap: anywhere; }
  .sidebar-spacer { flex: 1 0 20px; }
  .sidebar-public-note { display: flex; align-items: flex-start; gap: .5rem; border: 1px solid #f1e8d5; border-radius: 11px; padding: .65rem; background: #fffaf0; color: #82765e; font-size: .68rem; line-height: 1.45; }
  .note-dot { flex: 0 0 auto; width: .42rem; height: .42rem; margin-top: .18rem; border-radius: 50%; background: #d0a34a; }
  .sidebar-footer { display: grid; gap: .55rem; padding: 13px 2px 0; color: #9aa29b; font-size: .65rem; line-height: 1.45; }
  .sidebar-footer a { width: fit-content; color: #56735d; font-size: .71rem; font-weight: 700; }
  .workspace-main { display: flex; min-width: 0; min-height: 0; flex-direction: column; }
  .chat-header { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 1rem; padding: 2px 5px 13px; }
  .chat-heading { min-width: 0; }
  .chat-subtitle { margin-top: .23rem; color: #778078; font-size: .82rem; line-height: 1.4; }
  .header-status { display: flex; align-items: center; justify-content: flex-end; gap: .55rem; min-width: 0; }
  .model-chip { display: inline-flex; flex: 0 0 auto; align-items: center; gap: .42rem; border: 1px solid #e3e9e3; border-radius: 99px; padding: .38rem .65rem; background: #fff; color: #5a685d; font-size: .7rem; font-weight: 650; white-space: nowrap; }
  .model-dot { width: .43rem; height: .43rem; border-radius: 50%; background: #6e9c79; box-shadow: 0 0 0 3px #edf5ee; }
  .connection-pill { display: flex; align-items: flex-start; gap: .45rem; max-width: min(340px, 48vw); border: 1px solid #e1e9e2; border-radius: 12px; padding: .42rem .65rem; background: #f8fbf8; color: #69766b; font-size: .69rem; line-height: 1.4; }
  .connection-dot { flex: 0 0 auto; width: .43rem; height: .43rem; margin-top: .18rem; border-radius: 50%; background: #b5a06e; }
  .connection-pill[data-state="connected"] .connection-dot { background: #4c9b68; box-shadow: 0 0 0 3px #e7f3e9; }
  .connection-pill[data-state="reconnecting"] .connection-dot, .connection-pill[data-state="disconnected"] .connection-dot { background: #c47a61; box-shadow: 0 0 0 3px #faeee9; }
  .card { border: 1px solid #e7ebe7; border-radius: 20px; background: var(--surface); box-shadow: var(--shadow); }
  .chat { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; overflow: hidden; }
  .messages { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; gap: .24rem; overflow: auto; padding: clamp(1rem, 3vw, 2.1rem) clamp(1rem, 5vw, 4rem); scroll-behavior: smooth; }
  .empty { display: grid; flex: 1; align-content: center; justify-items: center; min-height: 300px; padding: 2rem; text-align: center; }
  .empty-mark { display: grid; place-items: center; width: 3rem; height: 3rem; margin-bottom: 1rem; border: 1px solid #dfeae0; border-radius: 1rem; background: linear-gradient(145deg, #f5faf5, #eaf3eb); color: var(--green); font-size: 1.45rem; box-shadow: 0 8px 22px rgb(43 93 57 / 8%); }
  .empty-copy { display: grid; gap: .42rem; max-width: 350px; }
  .empty-copy strong { color: #354237; font-size: 1.15rem; font-weight: 700; letter-spacing: -.025em; }
  .empty-copy span { color: #828b83; font-size: .84rem; line-height: 1.6; }
  .message { display: flex; align-items: flex-start; gap: .68rem; width: fit-content; max-width: min(90%, 780px); margin: .2rem 0 .75rem; }
  .message.agent { max-width: min(96%, 860px); }
  .message.mine { align-self: flex-end; flex-direction: row-reverse; }
  .speaker-avatar { width: 2rem; height: 2rem; margin-top: .12rem; font-size: .68rem; }
  .guest-avatar { border: 1px solid #dce6dd; background: #f0f5f0; color: #59715f; }
  .agent-avatar { border: 1px solid #d4e6d7; background: linear-gradient(145deg, #f3f8f3, #e5f0e6); color: var(--green); font-size: .92rem; }
  .system-avatar { border: 1px solid #e7e9e4; background: #f4f5f2; color: #849087; font-size: 1.2rem; }
  .message-body { min-width: 0; border: 1px solid #e8ece8; border-radius: 5px 16px 16px 16px; padding: .72rem .9rem .78rem; background: #fafbfa; }
  .message.mine .message-body { border-color: #dce9de; border-radius: 16px 5px 16px 16px; background: #eff6f0; }
  .message.agent .message-body { border-color: #e8ece8; background: white; box-shadow: 0 3px 12px rgb(32 48 35 / 3%); }
  .message.system { width: min(100%, 760px); max-width: 100%; margin: .35rem auto .8rem; }
  .message.system .message-body { width: 100%; border-style: dashed; background: #f7f8f5; }
  .message.streaming .message-body { border-color: #8bb69a; box-shadow: 0 0 0 3px rgb(73 137 94 / 7%); }
  .byline { margin-bottom: .34rem; color: #647166; font-size: .68rem; font-weight: 730; letter-spacing: .01em; }
  .message.agent .byline { color: #39704b; }
  .message-text { color: #374139; font-size: .87rem; line-height: 1.62; overflow-wrap: anywhere; white-space: pre-wrap; }
  .message-text.markdown { white-space: normal; }
  .message-text p { margin: 0; }
  .message-text p + p { margin-top: .75em; }
  .message-text ul, .message-text ol { margin: .45em 0 .65em; padding-left: 1.35em; }
  .message-text li + li { margin-top: .2em; }
  .message-text h1, .message-text h2, .message-text h3 { margin: .8em 0 .35em; color: #2c392f; line-height: 1.3; }
  .message-text h1 { font-size: 1.2em; }
  .message-text h2 { font-size: 1.1em; }
  .message-text h3 { font-size: 1em; }
  .message-text blockquote { margin: .5em 0; border-left: 3px solid #cbd8ca; padding-left: .8em; color: #5f6b5e; }
  .message-text pre { overflow-x: auto; margin: .65em 0; border-radius: .7em; padding: .85em; background: #202a22; color: #f3f6f2; }
  .message-text pre code { display: block; padding: 0; background: transparent; color: inherit; }
  .message-text code { border-radius: .28rem; padding: .12rem .28rem; background: #eef2ee; color: #405348; font-size: .9em; }
  .message-text pre code { background: transparent; color: inherit; }
  .message-text a { color: #2c7048; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
  .agent-thinking { display: flex; align-items: center; gap: .6rem; width: fit-content; margin: .2rem 0 .55rem .1rem; color: #758078; font-size: .75rem; }
  .agent-thinking .speaker-avatar { width: 1.75rem; height: 1.75rem; margin: 0; }
  .thinking-dots { color: #47835a; font-size: 1.12rem; font-weight: 800; letter-spacing: .08em; animation: thinking 1.15s ease-in-out infinite; }
  @keyframes thinking { 0%, 100% { opacity: .35; transform: translateY(1px); } 50% { opacity: 1; transform: translateY(-2px); } }
  .agent-activity { width: fit-content; max-width: min(86%, 760px); margin: -.35rem 0 .9rem 2.68rem; border: 1px solid #edf0ed; border-radius: 12px; padding: .55rem .7rem .65rem; background: #fbfcfb; color: #667168; font-size: .7rem; }
  .agent-activity.active { border-color: #d8e7da; background: #f7faf7; }
  .agent-activity-heading { display: flex; align-items: center; gap: .45rem; color: #59685c; cursor: pointer; font-weight: 700; list-style: none; }
  .agent-activity-heading::-webkit-details-marker { display: none; }
  .agent-activity:hover { border-color: #dce6dd; }
  .activity-icon { display: grid; flex: 0 0 auto; place-items: center; width: 1.35rem; height: 1.35rem; border: 1px solid #e1e9e1; border-radius: .43rem; background: white; color: #54785d; font-size: .72rem; }
  .agent-activity-status { margin-left: auto; color: #89928a; font-size: .65rem; font-weight: 500; }
  .agent-activity.active .agent-activity-status { color: #4c8058; }
  .activity-chevron { margin-left: .08rem; color: #89928a; font-size: .95rem; transition: transform .16s ease; }
  .agent-activity[open] .activity-chevron { transform: rotate(180deg); }
  .activity-events { display: grid; gap: .3rem; margin: .5rem 0 0 .12rem; border-left: 1px solid #dfe8e0; padding: .05rem 0 .05rem .85rem; list-style: none; }
  .activity-events li { position: relative; color: #78827a; line-height: 1.45; }
  .activity-events li::before { position: absolute; top: .32rem; left: -1.1rem; width: .38rem; height: .38rem; border: 1px solid #cbd9ce; border-radius: 50%; background: #fbfcfb; content: ""; }
  .composer { flex: 0 0 auto; margin: 0; border-top: 1px solid #edf0ed; padding: .9rem clamp(.75rem, 3vw, 1.45rem) .4rem; background: #fff; }
  .compose-card { border: 1px solid #e1e7e1; border-radius: 16px; padding: .55rem .65rem .65rem; background: #fff; box-shadow: 0 4px 18px rgb(31 52 36 / 5%); transition: border-color .16s ease, box-shadow .16s ease; }
  .compose-card:focus-within { border-color: #b6d0bb; box-shadow: 0 0 0 3px rgb(74 137 97 / 8%), 0 4px 18px rgb(31 52 36 / 5%); }
  .composer textarea { display: block; min-height: 66px; max-height: 180px; resize: vertical; border: 0; border-radius: 10px; padding: .55rem .5rem .65rem; background: transparent; font-size: .87rem; line-height: 1.5; }
  .composer textarea:focus { border: 0; box-shadow: none; }
  .compose-toolbar { display: flex; align-items: center; justify-content: space-between; gap: .75rem; border-top: 1px solid #f0f2ef; padding: .55rem .05rem 0; }
  .compose-meta { display: flex; align-items: center; gap: .55rem; min-width: 0; }
  .composer-model { padding: .3rem .55rem; font-size: .65rem; }
  .compose-hint { color: #929b93; font-size: .68rem; }
  .actions { display: flex; flex: 0 0 auto; gap: .45rem; }
  .actions button { min-height: 2.25rem; border-radius: .65rem; padding: .5rem .78rem; font-size: .75rem; }
  .button-icon { font-size: .85rem; }
  .composer-footnote { display: flex; justify-content: space-between; gap: .6rem; padding: .5rem .2rem .1rem; color: #9aa29b; font-size: .64rem; line-height: 1.4; }
  .error { min-height: 0; margin: 0; padding: 0 1rem; color: #a33e35; font-size: .77rem; }
  .error:not(:empty) { padding-top: .25rem; padding-bottom: .5rem; }

  .admin-shell { width: min(100% - 2rem, 1120px); margin: 0 auto; padding: 32px 0 24px; }
  .admin-topbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 24px; }
  .admin-header { align-items: flex-start; }
  .admin-header .brand-mark { width: 2.65rem; height: 2.65rem; }
  .admin-header h1 { margin-top: .25rem; font-size: 1.55rem; letter-spacing: -.045em; }
  .admin-header p:last-child { margin-top: .4rem; color: #7d877e; font-size: .82rem; line-height: 1.5; }
  .admin-chat-link { flex: 0 0 auto; border: 1px solid #e1e7e1; border-radius: 10px; padding: .62rem .8rem; background: white; color: #4f6c56; font-size: .76rem; font-weight: 680; }
  .admin-intro { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin: 28px 2px 13px; }
  .admin-intro h2 { margin-top: .32rem; color: #354137; font-size: 1.2rem; letter-spacing: -.03em; }
  .admin-intro > p { max-width: 430px; }
  .admin-grid { display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); align-items: start; gap: 14px; }
  .admin-section { min-width: 0; margin: 0 0 14px; border-radius: 17px; padding: 1.2rem; }
  .admin-gate { max-width: 540px; margin: 0 auto; }
  .section-heading { display: flex; align-items: flex-start; gap: .72rem; margin-bottom: 1rem; }
  .section-icon { display: grid; flex: 0 0 auto; place-items: center; width: 2rem; height: 2rem; border: 1px solid #e1e9e2; border-radius: .65rem; background: #f6f9f6; color: #56765e; font-size: .95rem; }
  .section-heading h2 { color: #354137; font-size: .98rem; letter-spacing: -.015em; }
  .section-heading .muted { margin-top: .28rem; font-size: .74rem; }
  .admin-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: .65rem; }
  .admin-form .wide { grid-column: 1 / -1; }
  .mcp-form { grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr); }
  .admin-form input { min-width: 0; padding: .7rem .8rem; font-size: .82rem; }
  .admin-form button { min-height: 2.55rem; font-size: .77rem; white-space: nowrap; }
  .form-actions { display: flex; flex-wrap: wrap; gap: .5rem; grid-column: 1 / -1; }
  .admin-status { min-height: 1.3rem; margin-top: .65rem; color: #69766b; font-size: .75rem; line-height: 1.5; overflow-wrap: anywhere; }
  .admin-error { color: #a33e35; }
  .admin-tools { display: grid; gap: .45rem; max-height: 280px; overflow: auto; margin: .45rem 0 0; padding: 0; list-style: none; }
  .admin-tools li { border: 1px solid #edf0ed; border-radius: 9px; padding: .55rem .65rem; color: #59655c; background: #fbfcfb; font-size: .73rem; line-height: 1.45; overflow-wrap: anywhere; }
  .admin-note { margin-top: .9rem; border-top: 1px solid #edf0ed; padding-top: .75rem; color: #8b948c; font-size: .68rem; line-height: 1.5; }
  .warning-note { color: #9a7c55; }
  .workspace-list-heading { display: flex; justify-content: space-between; gap: .5rem; margin-top: 1rem; border-bottom: 1px solid #edf0ed; padding-bottom: .5rem; color: #5f6c62; font-size: .7rem; font-weight: 700; }
  .workspace-list-heading .muted { font-size: .66rem; font-weight: 500; }
  .admin-list { display: grid; gap: .58rem; margin: .65rem 0 0; padding: 0; list-style: none; }
  .admin-item { display: flex; align-items: center; justify-content: space-between; gap: .8rem; border: 1px solid #e8ece8; border-radius: 11px; padding: .68rem; background: #fff; }
  .admin-item > div:first-child { display: grid; min-width: 0; gap: .28rem; }
  .admin-item a { width: fit-content; max-width: 100%; color: #3d6548; font-size: .8rem; font-weight: 700; overflow-wrap: anywhere; }
  .admin-item .muted { font-size: .67rem; overflow-wrap: anywhere; }
  .admin-item-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: .4rem; }
  .mcp-server-item .mcp-server-details { display: grid; flex: 1; min-width: 0; gap: .28rem; }
  .mcp-server-name { color: #3d6548; font-size: .8rem; }
  .mcp-server-url { font-size: .67rem; overflow-wrap: anywhere; }
  .mcp-server-health { color: #66766a; font-size: .69rem; }
  .mcp-tool-list { display: grid; gap: .35rem; max-height: 180px; overflow: auto; margin: .25rem 0 0; padding: 0; list-style: none; }
  .mcp-tool-list li { border: 1px solid #edf0ed; border-radius: 8px; padding: .45rem .55rem; color: #606c62; background: #fbfcfb; font-size: .67rem; line-height: 1.45; overflow-wrap: anywhere; }
  .admin-item-actions button { min-height: 2.15rem; padding: .45rem .58rem; font-size: .67rem; }
  .footer, .admin-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 20px; border-top: 1px solid #e5e9e5; padding: 13px 2px 0; color: #929a93; font-size: .69rem; line-height: 1.5; }
  .admin-footer a { flex: 0 0 auto; font-weight: 650; }
  code { border-radius: .25rem; padding: .1rem .25rem; background: #f0f2ed; }

  @media (max-width: 820px) {
    .workspace-shell { grid-template-columns: 228px minmax(0, 1fr); gap: 10px; padding: 10px; }
    .workspace-sidebar { border-radius: 18px; padding: 16px 12px 12px; }
    .admin-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    body { background: #f4f6f3; }
    .workspace-shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 8px; width: 100%; height: 100dvh; padding: 8px; }
    .workspace-sidebar { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto auto; align-items: center; gap: 8px 10px; overflow: visible; border-radius: 15px; padding: 10px; }
    .workspace-sidebar > .brand { grid-column: 1; grid-row: 1; gap: .5rem; }
    .brand-mark { width: 2rem; height: 2rem; border-radius: .65rem; font-size: 1rem; }
    .brand-name { font-size: .72rem; }
    .brand-caption { font-size: .64rem; }
    .sidebar-block.workspace-card { grid-column: 1; grid-row: 2; border: 0; padding: 0 0 0 2px; }
    .workspace-card .eyebrow { display: none; }
    .workspace-card h1 { overflow: hidden; margin: 0; font-size: .86rem; text-overflow: ellipsis; white-space: nowrap; }
    .access-note { display: none; }
    .profile-block { grid-column: 2; grid-row: 1 / span 2; width: min(42vw, 190px); border: 0; padding: 0; }
    .profile-block > .eyebrow, .field-hint { display: none; }
    .profile-field { gap: .35rem; margin: 0; }
    .profile-avatar { width: 1.75rem; height: 1.75rem; }
    .profile-field input { padding: .42rem .15rem; font-size: .77rem; }
    .workspace-sidebar .mcp-panel { display: block; grid-column: 1 / -1; grid-row: 3; margin-top: 0; }
    .mcp-panel[open] { max-height: 22vh; overflow-y: auto; }
    .sidebar-spacer, .sidebar-public-note, .sidebar-footer { display: none; }
    .workspace-main { min-height: 0; }
    .chat-header { align-items: flex-start; gap: .5rem; padding: 0 3px 7px; }
    .chat-heading .eyebrow { font-size: .59rem; }
    .chat-subtitle { max-width: 45vw; margin-top: .18rem; font-size: .68rem; }
    .header-status { flex-direction: column-reverse; align-items: flex-end; gap: .25rem; }
    .header-status > .model-chip { display: none; }
    .connection-pill { max-width: min(52vw, 230px); border-color: transparent; padding: .28rem .35rem; background: transparent; font-size: .61rem; }
    .chat { border-radius: 15px; }
    .messages { padding: 1rem .75rem; }
    .empty { min-height: 220px; padding: 1rem; }
    .empty-mark { width: 2.6rem; height: 2.6rem; margin-bottom: .8rem; }
    .empty-copy strong { font-size: 1.03rem; }
    .empty-copy span { font-size: .77rem; }
    .message { max-width: 96%; gap: .45rem; }
    .message.agent { max-width: 100%; }
    .speaker-avatar { width: 1.75rem; height: 1.75rem; font-size: .62rem; }
    .message-body { padding: .62rem .7rem .68rem; }
    .message-text { font-size: .81rem; }
    .agent-activity { max-width: calc(100% - 2.15rem); margin-left: 2.15rem; padding: .5rem .58rem .58rem; font-size: .66rem; }
    .agent-activity-status { font-size: .61rem; }
    .composer { padding: .6rem .55rem .35rem; }
    .compose-card { border-radius: 13px; padding: .4rem .45rem .45rem; }
    .composer textarea { min-height: 57px; padding: .45rem .4rem .5rem; font-size: .82rem; }
    .compose-toolbar { align-items: flex-end; gap: .35rem; padding-top: .42rem; }
    .compose-meta { align-items: flex-start; flex-direction: column; gap: .25rem; }
    .compose-hint { display: none; }
    .composer-model { padding: .25rem .45rem; font-size: .6rem; }
    .actions { gap: .3rem; }
    .actions button { min-height: 2.1rem; padding: .43rem .52rem; font-size: .66rem; }
    .button-icon { display: none; }
    .composer-footnote { padding: .38rem .1rem .05rem; font-size: .58rem; }
    .composer-footnote span:last-child { display: none; }
    .admin-shell { width: min(100% - 1.1rem, 680px); padding-top: 18px; }
    .admin-topbar { align-items: flex-start; margin-bottom: 17px; }
    .admin-header h1 { font-size: 1.25rem; }
    .admin-header p:last-child { max-width: 380px; font-size: .74rem; }
    .admin-chat-link { padding: .5rem .55rem; font-size: .66rem; }
    .admin-intro { align-items: flex-start; flex-direction: column; gap: .45rem; margin-top: 20px; }
    .admin-intro > p { font-size: .74rem; }
    .admin-section { padding: .95rem; }
    .admin-form { grid-template-columns: minmax(0, 1fr); }
    .admin-form .wide { grid-column: auto; }
    .form-actions { grid-column: auto; }
    .mcp-form { grid-template-columns: minmax(0, 1fr); }
    .mcp-form .wide { grid-column: auto; }
    .admin-form button { width: 100%; }
    .admin-item { align-items: stretch; flex-direction: column; }
    .admin-item-actions { justify-content: stretch; }
    .admin-item-actions button { flex: 1; }
    .admin-footer { align-items: flex-start; flex-direction: column; gap: .45rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
  }
`;
