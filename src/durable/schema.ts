export const CHAT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,
    password_hash TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_by TEXT,
    workspace_id TEXT
  );
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, member_id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'untested',
    oauth_state TEXT,
    tool_cache TEXT NOT NULL DEFAULT '[]',
    authorization_url TEXT,
    last_error TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS skill_files (
    skill_id TEXT NOT NULL,
    path TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (skill_id, path)
  );
  CREATE TABLE IF NOT EXISTS proactive_followups (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    trigger_message_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    message TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'delivering', 'delivered', 'resolved'))
  );
  CREATE INDEX IF NOT EXISTS messages_workspace_created ON messages(workspace_id, created_at, id);
  CREATE INDEX IF NOT EXISTS proactive_followups_due ON proactive_followups(status, due_at);
`;

export const LEGACY_COLUMNS: readonly { table: string; column: string; definition: string }[] = [
  { table: "members", column: "password_hash", definition: "TEXT" },
  { table: "invites", column: "workspace_id", definition: "TEXT" },
  { table: "connectors", column: "status", definition: "TEXT NOT NULL DEFAULT 'untested'" },
  { table: "connectors", column: "oauth_state", definition: "TEXT" },
  { table: "connectors", column: "tool_cache", definition: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "connectors", column: "authorization_url", definition: "TEXT" },
  { table: "connectors", column: "last_error", definition: "TEXT" },
];
