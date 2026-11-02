#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function ensureLocalAdminSecret(path = resolve('.dev.vars')) {
  const original = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const lines = original.split(/\r?\n/u);
  const index = lines.findIndex((line) => /^\s*ADMIN_SECRET\s*=/u.test(line));
  const raw = index >= 0 ? lines[index].slice(lines[index].indexOf('=') + 1).trim() : '';
  const existing = raw.replace(/^(?:"([^"]*)"|'([^']*)')$/u, (_match, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted ?? '');
  if (existing) return { secret: existing, generated: false };

  const secret = randomBytes(32).toString('base64url');
  const line = `ADMIN_SECRET=${secret}`;
  if (index >= 0) lines[index] = line;
  else lines.push(line);
  writeFileSync(path, lines.join('\n').replace(/\n*$/u, '\n'), { mode: 0o600 });
  chmodSync(path, 0o600);
  return { secret, generated: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { generated } = ensureLocalAdminSecret();
  console.log(generated
    ? 'Generated ADMIN_SECRET in ignored .dev.vars. Read it locally to unlock /admin; its value was not printed.'
    : 'ADMIN_SECRET already exists in ignored .dev.vars; its value was not printed.');
}
