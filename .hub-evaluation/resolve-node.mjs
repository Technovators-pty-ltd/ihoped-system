// Trusted wrapper, mounted read-only. No application install hooks are enabled.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const path=process.env.RESOLVE_PROJECT;
if(!path || !/^(?:(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+|\.)$/.test(path))throw new Error('Invalid fixed package path');
mkdirSync('/work/home',{recursive:true});
cpSync('/source','/work/project',{recursive:true});
const project=resolve('/work/project',path);
const snapshot=()=>['package.json','pnpm-workspace.yaml'].map(name=>{
  const filename=resolve(project,name);
  return existsSync(filename)?createHash('sha256').update(readFileSync(filename)).digest('hex'):null;
});
const before=snapshot();
const child=spawnSync('corepack',['pnpm','install','--lockfile-only','--no-frozen-lockfile','--ignore-scripts','--ignore-pnpmfile'],{
  cwd:project,encoding:'utf8',maxBuffer:4_000_000,timeout:840_000,
});
if(child.stdout)process.stderr.write(child.stdout.slice(-12000));
if(child.stderr)process.stderr.write(child.stderr.slice(-12000));
if(child.error || child.status!==0){process.stderr.write('\nFixed package-manager resolution failed.\n');process.exit(1);}
if(JSON.stringify(before)!==JSON.stringify(snapshot()))throw new Error('Package manager changed manifest behavior');
const filename=resolve(project,'pnpm-lock.yaml');const stat=lstatSync(filename);
if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>2_000_000)throw new Error('Invalid generated lockfile');
const bytes=readFileSync(filename);new TextDecoder('utf-8',{fatal:true}).decode(bytes);
process.stdout.write(bytes);
