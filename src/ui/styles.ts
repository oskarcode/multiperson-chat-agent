export const appStyles = String.raw`
    :root { color-scheme: light; font-chat: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #20242c; background: #f7f8fa; --accent:#f06449; --accent-hover:#da5239; --accent-soft:#fff0eb; --blue:#2563eb; --surface:#fff; --surface-muted:#f6f7f9; --line:#e5e7eb; --text-muted:#68707d; --danger:#b4233c; --shadow-sm:0 1px 2px rgb(16 24 40 / 5%); --shadow-lg:0 16px 40px rgb(16 24 40 / 10%); }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { margin: 0; background: #f7f8fa; color: #20242c; font-size: .9375rem; line-height: 1.5; }
    body.app-ready { overflow: hidden; }
    button, input, textarea, select { font: inherit; }
    button { min-height: 2.375rem; border: 1px solid var(--line); border-radius: .625rem; padding: .5rem .75rem; background: var(--surface); color: inherit; box-shadow: var(--shadow-sm); cursor: pointer; font-weight: 700; transition: background 140ms ease, border-color 140ms ease, transform 140ms ease; }
    button:hover:not(:disabled) { border-color: #c9cdd4; background: #fafafa; }
    button:active:not(:disabled) { transform: translateY(1px); }
    button.secondary { background: var(--surface); color: #20242c; }
    button.agent, #sendGroup { border-color: var(--accent); background: var(--accent); color: white; }
    #sendGroup { border-color: var(--blue); background: var(--blue); }
    button.agent:hover:not(:disabled), #sendGroup:hover:not(:disabled) { background: var(--accent-hover); color: white; }
    input, textarea, select { width: 100%; border: 1px solid var(--line); border-radius: .625rem; padding: .625rem .75rem; background: white; color: #20242c; }
    textarea { min-height: 5rem; resize: vertical; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 1.5rem; }
    body.app-ready .shell { max-width: none; height: 100dvh; padding: 0; }
    body.app-ready .hero { display: none; }
    .hero, .card { background: var(--surface); border: 1px solid var(--line); border-radius: 1rem; padding: 1rem; box-shadow: var(--shadow-lg); }
    .hero { background: linear-gradient(135deg, #fff, var(--accent-soft)); border-radius: 1.25rem; padding: 1.5rem; }
    .hero h1 { margin: 0 0 .25rem; font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -.045em; }
    .auth { max-width: 1000px; margin: 1rem auto 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .story { background: linear-gradient(160deg, #20242c, var(--accent)); color: white; border: 0; padding: 1.4rem; }
    .story h2 { font-size: clamp(1.8rem, 4vw, 3rem); line-height: 1; letter-spacing: -.04em; margin: 0 0 1rem; }
    .story p, .story .muted { color: rgba(255,255,255,.82); }
    .pill-list { display: grid; gap: .65rem; margin-top: 1.25rem; }
    .pill { display: flex; gap: .6rem; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); border-radius: .875rem; padding: .75rem; }
    .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: .35rem; background: var(--surface-muted); padding: .35rem; border-radius: .875rem; }
    .tabs button { background: transparent; color: var(--text-muted); box-shadow: none; padding: .55rem; }
    .tabs button.active { background: white; color: #20242c; box-shadow: var(--shadow-sm); }
    .grid { display: grid; grid-template-columns: 280px minmax(0,1fr); gap: 1rem; margin-top: 1rem; }
    body.app-ready .grid { height: 100dvh; grid-template-columns: minmax(15rem, 17.5rem) minmax(0, 1fr); gap: 0; margin: 0; background: var(--surface); }
    body.app-ready .grid > .card { min-height: 0; border-width: 0; border-radius: 0; box-shadow: none; }
    body.app-ready .grid > aside:first-child { display: flex; flex-direction: column; overflow-y: auto; border-right: 1px solid var(--line); background: var(--surface-muted); padding: 1rem; }
    body.app-ready .grid > aside:last-child { overflow-y: auto; border-left: 1px solid var(--line); background: var(--surface); padding: 1rem; }
    body.app-ready .grid > section.card { display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; gap: 0; padding: 0; overflow: hidden; }
    body.app-ready .grid > section.card > .row:first-child { padding: .875rem 1.25rem; border-bottom: 1px solid var(--line); background: rgb(255 255 255 / 92%); backdrop-filter: blur(12px); }
    body.app-ready .grid h2 { margin: .5rem 0; letter-spacing: -.02em; }
    body.app-ready aside h2 { color: var(--text-muted); font-size: .75rem; letter-spacing: .08em; text-transform: uppercase; }
    .stack { display: grid; gap: .75rem; }
    .row { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    .muted { color: var(--text-muted); font-size: .92rem; }
    .error { color: var(--danger); font-weight: 800; }
    .hidden { display: none !important; }
    .item { display: block; width: 100%; border: 0; box-shadow: none; text-align: left; margin-bottom: .4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item.active { background: var(--surface); color: #20242c; box-shadow: var(--shadow-sm); font-weight: 700; }
    .messages { height: 56vh; overflow-y: auto; overflow-anchor: none; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 1.15rem; padding: 1.75rem max(1rem, calc((100% - 52rem) / 2)); background: var(--surface); scrollbar-gutter: stable; }
    body.app-ready .messages { height: auto; min-height: 0; }
    .msg { display: grid; gap: .375rem; max-width: 48rem; white-space: pre-wrap; overflow-wrap: anywhere; }
    .msg.mine { align-self: flex-end; width: fit-content; max-width: min(82%, 42rem); padding: .8rem 1rem; border: 1px solid #e9e6e2; border-radius: 1.25rem 1.25rem .35rem 1.25rem; background: #f4f2ef; color: #2f2c29; }
    .msg.agent, .msg.agent-request { align-self: stretch; padding-inline: .125rem; border: 0; background: transparent; }
    .msg.agent-request { color: var(--accent); }
    .msg:not(.mine):not(.agent):not(.agent-request) { width: fit-content; max-width: min(82%, 42rem); padding: .8rem 1rem; border: 1px solid var(--line); border-radius: 1.25rem 1.25rem 1.25rem .35rem; background: var(--surface-muted); }
    .byline { color: var(--text-muted); font-weight: 700; font-size: .6875rem; letter-spacing: .02em; }
    .msg.mine .byline { color: #837e78; }
    #composer { width: calc(100% - 2.5rem); min-height: 5rem; margin: 1rem 1.25rem .75rem; border-radius: .875rem; resize: none; }
    #composer + .row { padding: 0 1.25rem 1rem; }
    #chatError { padding: 0 1.25rem 1rem; }
    #members > div { display: grid; gap: .125rem; padding: .35rem 0; }
    #roomInviteResult { overflow-wrap: anywhere; flex-basis:100%; text-align:left; max-width:34rem; }
    .invite-guide { display:grid; gap:.35rem; padding:.7rem .8rem; border:1px solid var(--line); border-radius:.8rem; background:#fffaf8; box-shadow:var(--shadow-sm); font-size:.78rem; }
    .invite-guide ol { margin:.25rem 0 0 1.1rem; padding:0; }
    .invite-guide li { margin:.18rem 0; }
    #connectors .card { box-shadow: var(--shadow-sm); }
    code { background: var(--surface-muted); padding: .15rem .35rem; border-radius: .4rem; }
    pre { overflow: auto; max-height: 12rem; }
    /* Current pi-durable-chat inspired shell: warm GroupOS sidebar, central transcript, floating composer. */
    body.app-ready .grid { grid-template-columns: minmax(15rem, 17.5rem) minmax(0, 1fr); background:#fff; }
    body.app-ready .session-sidebar-lite { background:#fafafa; border-right:1px solid var(--line); padding:0; }
    .workspace-brand { display:flex; min-width:0; align-items:center; gap:.65rem; padding:.95rem .9rem; border-bottom:1px solid var(--line); }
    .workspace-brand > span:last-child { display:grid; min-width:0; }
    .workspace-brand strong, .workspace-brand small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .workspace-brand small { color:var(--text-muted); font-size:.7rem; }
    .workspace-avatar, .workspace-monogram { display:inline-grid; flex:none; place-items:center; background:#e8e6e2; color:#57534e; font-weight:650; text-transform:uppercase; }
    .workspace-avatar { width:2rem; height:2rem; border-radius:.55rem; }
    .new-workspace-button { display:flex; width:calc(100% - 1.5rem); align-items:center; justify-content:flex-start; gap:.5rem; margin:.8rem .75rem .35rem; border:0; background:#e9e7e4; box-shadow:none; font-weight:600; }
    .new-workspace-button:hover:not(:disabled) { background:#dfddd9; }
    .compact-input { width:calc(100% - 1.5rem); margin:0 .75rem .7rem; min-height:2.2rem; padding:.45rem .65rem; background:#fff; }
    .sidebar-section { padding:1rem .55rem .5rem; border-top:1px solid var(--line); }
    .sidebar-label-row { display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding-inline:.35rem; margin-bottom:.65rem; }
    .sidebar-label-row h2 { margin:0; color:#8a8782; font-size:.69rem; font-weight:650; letter-spacing:.09em; text-transform:uppercase; }
    .sidebar-label-row span { color:#9b9893; font-size:.68rem; }
    .nav-list { display:grid; gap:.18rem; }
    .nav-list .item { display:flex; align-items:center; gap:.55rem; min-height:2.25rem; margin:0; padding:.42rem; border-radius:.55rem; background:transparent; color:#34312e; font-size:.82rem; }
    .nav-list .item::before { content:attr(data-initials); display:inline-grid; width:1.65rem; height:1.65rem; flex:none; place-items:center; border-radius:.45rem; background:#e8e6e2; color:#57534e; font-size:.61rem; font-weight:700; }
    .nav-list .item.active { background:#ebe9e6; box-shadow:none; }
    .people-list-lite { display:grid; gap:.35rem; padding-inline:.35rem; }
    .people-list-lite > div { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:.55rem; padding:.3rem 0; }
    .people-list-lite > div::before { content:attr(data-initial); display:inline-grid; width:1.7rem; height:1.7rem; place-items:center; border-radius:.45rem; background:#efede9; color:#595550; font-size:.68rem; font-weight:700; }
    .small-button { min-height:2rem; padding:.3rem .65rem; font-size:.78rem; }
    .session-sidebar-footer-lite { margin-top:auto; display:grid; gap:.4rem; padding:.8rem .9rem; border-top:1px solid var(--line); }
    .session-sidebar-footer-lite small { overflow:hidden; color:var(--text-muted); font-size:.65rem; text-overflow:ellipsis; white-space:nowrap; }
    body.app-ready .conversation-view-lite { display:grid; grid-template-rows:auto minmax(0,1fr) auto auto; background:#fff; }
    .conversation-header-lite { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.875rem 1.25rem; border-bottom:1px solid var(--line); background:rgb(255 255 255 / 92%); backdrop-filter:blur(12px); }
    .conversation-header-lite h2 { margin:0; color:#211f1d; font-size:1.05rem; }
    .conversation-header-lite small { color:var(--text-muted); font-size:.7rem; }
    .conversation-header-lite p { margin:0; }
    .room-actions { display:flex; align-items:center; justify-content:flex-end; gap:.75rem; flex-wrap:wrap; }
    body.app-ready .messages { padding:1.75rem max(1rem, calc((100% - 52rem) / 2)); }
    .msg.agent, .msg.agent-request { max-width:48rem; }
    .msg.agent .byline, .msg.agent-request .byline { color:#8a8782; }
    .msg.agent > div:last-child, .msg.agent-request > div:last-child { color:#24211f; line-height:1.55; }
    .prompt-bar { display:grid; gap:.1rem; width:min(calc(100% - 2rem), 62rem); max-width:62rem; margin:0 auto .75rem; padding:.35rem; border:1px solid #d9dce2; border-radius:1.35rem; background:#fff; box-shadow:0 10px 30px rgb(16 24 40 / 10%); transition:border-color 140ms ease, box-shadow 140ms ease; }
    .prompt-bar:focus-within { border-color:color-mix(in srgb, var(--accent) 45%, #d9dce2); box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 9%, transparent), 0 12px 34px rgb(16 24 40 / 12%); }
    #composer { width:100%; min-height:3.25rem; max-height:12rem; margin:0; padding:.7rem .9rem .2rem; resize:none; overflow-y:hidden; border:0; border-radius:1rem; background:transparent; box-shadow:none; font-size:1rem; line-height:1.5; }
    #composer:focus { outline:0; }
    .composer-footer { display:flex; min-height:2.35rem; align-items:center; justify-content:space-between; gap:.75rem; padding:.25rem .3rem .3rem .7rem; }
    .composer-status { display:grid; min-width:0; color:var(--text-muted); font-size:.7rem; }
    .composer-actions { display:flex; flex:none; gap:.45rem; }
    .prompt-bar button { min-width:5rem; min-height:2.2rem; padding:.35rem .8rem; border-radius:999px; font-weight:650; }
    .prompt-bar .ask-agent-button { min-width:6.25rem; border-color:var(--accent); background:var(--accent); color:white; box-shadow:0 4px 12px rgb(240 100 73 / 20%); }
    .prompt-bar .ask-agent-button:hover:not(:disabled) { border-color:var(--accent-hover); background:var(--accent-hover); }
    .prompt-bar .send-group-button { border-color:#ddd9d4; background:#f1efec; color:#4f4a45; box-shadow:none; }
    .prompt-bar .send-group-button:hover:not(:disabled) { border-color:#cfcbc5; background:#e7e4e0; color:#302d2a; }
    .settings-launcher { justify-content:flex-start; box-shadow:none; }
    .settings-backdrop { display:none; position:fixed; inset:0; z-index:20; background:rgb(0 0 0 / 34%); backdrop-filter:blur(5px); }
    body.settings-open .settings-backdrop { display:block; }
    .connections-panel { display:none; position:fixed; z-index:21; top:50%; left:50%; width:min(100% - 2rem, 34rem); max-height:min(82dvh, 48rem); overflow-y:auto; transform:translate(-50%, -50%); padding:1rem; border:1px solid var(--line); border-radius:1rem; background:#fff; box-shadow:0 30px 90px rgb(20 18 16 / 24%); }
    body.app-ready .grid > .connections-panel { position:fixed; min-height:0; border:1px solid var(--line); border-radius:1rem; padding:1rem; background:#fff; box-shadow:0 30px 90px rgb(20 18 16 / 24%); }
    body.settings-open .connections-panel { display:grid; }
    .settings-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
    .settings-header small { color:var(--text-muted); font-size:.72rem; }
    .settings-header h2 { margin:.1rem 0 0; color:#20242c; font-size:1.25rem; letter-spacing:-.03em; text-transform:none; }
    .settings-close { width:2.35rem; min-width:2.35rem; border:0; border-radius:.8rem; background:#f8f7f6; box-shadow:none; font-size:1.2rem; }
    .settings-tabs { display:flex; gap:.35rem; padding:.35rem; border-radius:.85rem; background:#f6f4f2; }
    .settings-tabs button { min-height:2.1rem; border:0; background:transparent; box-shadow:none; color:#605c57; font-weight:500; }
    .settings-tabs button.active { background:#fff; color:#20242c; box-shadow:var(--shadow-sm); }
    .settings-section-card { display:grid; gap:.65rem; padding:.85rem; border:1px solid var(--line); border-radius:.85rem; background:#fff; }
    .settings-panel-view.hidden { display:none; }
    .calendar-toolbar { display:grid; grid-template-columns:1fr auto; gap:.5rem; align-items:end; }
    .schedule-list { display:grid; gap:.5rem; max-height:20rem; overflow:auto; }
    .schedule-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.65rem; align-items:center; padding:.7rem; border:1px solid var(--line); border-radius:.75rem; background:#fafafa; }
    .schedule-item strong, .schedule-item small { overflow:hidden; text-overflow:ellipsis; }
    .schedule-item time { color:var(--accent); font-size:.75rem; font-weight:700; }
    .connections-panel h2 { margin:.35rem 0 0; color:#8a8782; font-size:.69rem; letter-spacing:.09em; text-transform:uppercase; }
    .empty-chat { min-height:100%; display:grid; place-content:center; gap:1rem; padding:2rem; text-align:center; background:linear-gradient(180deg, transparent 0 30%, #fff 60%), repeating-linear-gradient(25deg, transparent 0 28px, rgb(233 231 228 / 35%) 29px 30px); }
    .empty-chat-mark { display:inline-grid; place-self:center; width:2.2rem; height:2.2rem; place-items:center; border-radius:.85rem; background:#fff0eb; color:var(--accent); }
    .empty-chat h2 { margin:0; color:#211f1d; font-size:clamp(2rem, 4vw, 2.7rem); line-height:1.05; letter-spacing:-.06em; }
    .empty-chat p { margin:0; color:var(--text-muted); }
    @media (max-width: 900px) { body.app-ready { overflow: auto; } .grid, .auth, body.app-ready .grid { grid-template-columns: 1fr; height: auto; } body.app-ready .grid > aside:first-child, body.app-ready .grid > aside:last-child { border: 0; } .messages { height: 44vh; } .msg, .msg.mine { max-width: 100%; } .conversation-header-lite { display:grid; } .connections-panel { width:min(100% - 1rem, 34rem); } }
`;
