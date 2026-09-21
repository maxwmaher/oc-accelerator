import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const normal = text => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blobSha = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const occurrences = (text, needle) => text.split(needle).length - 1;

export function applyEdits(source, edits, label) {
  let result = normal(source);
  for (const { before, after } of edits) {
    if (after && result.includes(after)) continue;
    const count = occurrences(result, before);
    if (!after && count === 0) continue;
    if (count !== 1) throw new Error(`${label}: expected one matching source block; found ${count}. No files were changed. This file may contain additional local edits.`);
    result = result.replace(before, after);
  }
  return source.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
}

export function install(repoRoot, packageRoot, checkOnly = false) {
  const storefront = path.join(path.resolve(repoRoot), 'apps', 'storefront');
  const packageFile = path.join(storefront, 'package.json');
  if (!fs.existsSync(packageFile)) throw new Error(`Storefront package.json not found: ${storefront}`);
  const project = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  if (project.name !== 'ordercloud-accelerator-storefront') throw new Error('This is not the expected accelerator storefront. No files were changed.');
  const edits = JSON.parse(fs.readFileSync(path.join(packageRoot, 'edits.json'), 'utf8'));
  const replacements = JSON.parse(fs.readFileSync(path.join(packageRoot, 'replacements.json'), 'utf8'));
  const plans = [];
  const safePath = relative => {
    const target = path.resolve(storefront, relative);
    if (!target.startsWith(storefront + path.sep)) throw new Error('Unsafe target path.');
    return target;
  };
  for (const relative of new Set(edits.map(e => e.path))) {
    const target = safePath(relative);
    const previous = fs.readFileSync(target, 'utf8');
    const updated = applyEdits(previous, edits.filter(e => e.path === relative), relative);
    if (previous !== updated) plans.push({ relative, target, previous, updated });
  }
  for (const replacement of replacements) {
    const relative = replacement.path;
    const target = safePath(relative);
    const previous = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    const payload = fs.readFileSync(path.join(packageRoot, 'payload', relative), 'utf8');
    if (previous !== null && normal(previous) === normal(payload)) continue;
    if (replacement.originalBlob) {
      if (previous === null || blobSha(normal(previous)) !== replacement.originalBlob) {
        throw new Error(`${relative}: existing component differs from the reviewed version. No files were changed.`);
      }
    } else if (previous !== null) {
      throw new Error(`${relative}: a different helper already exists. No files were changed.`);
    }
    const updated = previous?.includes('\r\n') ? normal(payload).replace(/\n/g, '\r\n') : payload;
    plans.push({ relative, target, previous, updated });
  }
  for (const plan of plans) console.log(`[PLAN] ${plan.previous === null ? 'ADD' : 'EDIT'} ${plan.relative}`);
  if (checkOnly) { console.log(`Preflight passed: ${plans.length} local source files would change.`); return { changed: 0 }; }
  if (!plans.length) { console.log('Quantity UI update is already applied. No files changed.'); return { changed: 0 }; }
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  const backupRoot = path.join(packageRoot, 'backups', stamp);
  fs.mkdirSync(backupRoot, { recursive: true });
  for (const plan of plans) {
    if (plan.previous !== null) {
      const file = path.join(backupRoot, plan.relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, plan.previous, 'utf8');
    }
  }
  fs.writeFileSync(path.join(backupRoot, 'manifest.json'), JSON.stringify({ storefront,
    files: plans.map(p => ({ path: p.relative, existed: p.previous !== null, installedSha256: sha(p.updated) }))
  }, null, 2));
  const written = [];
  try {
    for (const plan of plans) {
      fs.mkdirSync(path.dirname(plan.target), { recursive: true });
      written.push(plan);
      fs.writeFileSync(plan.target, plan.updated, 'utf8');
      console.log(`[APPLIED] ${plan.relative}`);
    }
  } catch (error) {
    for (const plan of written.reverse()) {
      if (plan.previous === null) fs.rmSync(plan.target, { force: true });
      else fs.writeFileSync(plan.target, plan.previous, 'utf8');
    }
    throw error;
  }
  console.log(`Source backup: ${backupRoot}`);
  console.log('QUANTITY UI UPDATE APPLIED - local source only. Build and deploy the storefront next.');
  console.log('No OrderCloud/Azure settings, credentials, seed data, admin code, or Functions code were changed.');
  return { changed: plans.length, backupRoot };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const repo = process.argv[2];
    if (!repo) throw new Error('Usage: node apply-quantity-ui.mjs <repo-root> [--check]');
    install(repo, path.dirname(fileURLToPath(import.meta.url)), process.argv.includes('--check'));
  } catch (error) { console.error(`STOPPED: ${error.message}`); process.exitCode = 1; }
}
