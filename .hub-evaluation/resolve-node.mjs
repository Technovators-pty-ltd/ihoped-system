// Trusted wrapper, mounted read-only. No application install hooks are enabled.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve,dirname } from 'node:path';
import {createRequire} from 'node:module';

const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const reject=()=>{throw new Error('This npm profile requires a v3 public-registry tarball lock without shrinkwrap, links, Git, local or custom-host downloads.');};
const packageName=/^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/;
function registrySpec(name,spec,parseSpec){
 if(!packageName.test(name)||name.length>214||typeof spec!=='string'||!spec||spec.length>500)reject();
 let selected;try{selected=parseSpec.resolve(name,spec);}catch{reject();}
 if(selected?.type==='alias')selected=selected.subSpec;
 if(!selected?.registry||!['range','version','tag'].includes(selected.type))reject();
}
function dependencies(value,parseSpec){
 if(value===undefined)return;
 if(!record(value))reject();
 for(const [name,spec]of Object.entries(value))registrySpec(name,spec,parseSpec);
}
export function assertPublicNpmManifest(manifest,parseSpec){
 if(!record(manifest))reject();
 for(const key of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])dependencies(manifest[key],parseSpec);
 let count=0;
 const overrides=(table,parent,depth=0)=>{
   if(!record(table)||depth>16)reject();
   for(const [selector,value]of Object.entries(table)){
     if(++count>10000)reject();
     let name=parent;
     if(selector!=='.'){
       let selected;try{selected=parseSpec(selector);}catch{reject();}
       if(!selected?.registry||!packageName.test(selected.name||'')||!['range','version','tag'].includes(selected.type))reject();
       name=selected.name;
     }
     if(!name)reject();
     if(record(value)){overrides(value,name,depth+1);continue;}
     if(typeof value==='string'&&value.startsWith('$')){
       const key=value.slice(1);const target=manifest.dependencies?.[key]??manifest.devDependencies?.[key]??manifest.optionalDependencies?.[key]??manifest.peerDependencies?.[key];
       registrySpec(key,target,parseSpec);
     }else registrySpec(name,value,parseSpec);
   }
 };
 if(manifest.overrides!==undefined)overrides(manifest.overrides);
}
export function assertPublicNpmLock(lock,parseSpec){
 if(!record(lock)||lock.lockfileVersion!==3||lock.dependencies!==undefined||!record(lock.packages)||!Object.hasOwn(lock.packages,'')||!record(lock.packages['']))reject();
 if(Object.keys(lock.packages).length>10000)reject();
 for(const [path,entry]of Object.entries(lock.packages)){
   if(!record(entry))reject();
   if(parseSpec)for(const key of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])dependencies(entry[key],parseSpec);
   if(path==='')continue;
   if(!/^(?:node_modules\/(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*)(?:\/node_modules\/(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(path)||entry.link||entry.inBundle||typeof entry.version!=='string'||entry.version.length>120||!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/.test(entry.version))reject();
   if(typeof entry.resolved!=='string'||entry.resolved.length>2048||/[\\?#]/.test(entry.resolved))reject();
   let url;try{url=new URL(entry.resolved);}catch{reject();}
   if(url.origin!=='https://registry.npmjs.org'||url.username||url.password||url.port||url.search||url.hash||url.href!==entry.resolved||!/^\/(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*\/-\/[A-Za-z0-9][A-Za-z0-9._+-]*[.]tgz$/.test(url.pathname))reject();
   if(typeof entry.integrity!=='string'||entry.integrity.length>1024||!/^sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2}(?: sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2})*$/.test(entry.integrity))reject();
 }
}
function npmDocument(filename){
 const stat=lstatSync(filename);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>2_000_000)reject();
 const bytes=readFileSync(filename);
 try{return {bytes,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};}catch{reject();}
}
const npmJson=filename=>npmDocument(filename).value;
function entryExists(filename){try{lstatSync(filename);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}

export function stageNpmInputs(sourceProject,destination,mode,parseSpec){
 if(!['resolve','verify'].includes(mode)||entryExists(resolve(sourceProject,'npm-shrinkwrap.json')))reject();
 const manifest=npmDocument(resolve(sourceProject,'package.json'));
 const lock=npmDocument(resolve(sourceProject,'package-lock.json'));
 const pkg=manifest.value;
 assertPublicNpmManifest(pkg,parseSpec);assertPublicNpmLock(lock.value,parseSpec);
 if(pkg.workspaces||(pkg.packageManager&&pkg.packageManager!=='npm@11.19.1'))throw new Error('Unsupported original npm workspace or toolchain');
 // Exclusive creation plus a whitelist prevents inherited installed trees,
 // hidden locks, yarn locks or parent workspace/config files influencing npm.
 mkdirSync(destination,{mode:0o700});
 writeFileSync(resolve(destination,'package.json'),manifest.bytes,{flag:'wx',mode:0o600});
 if(mode==='verify')writeFileSync(resolve(destination,'package-lock.json'),lock.bytes,{flag:'wx',mode:0o600});
}

function main(){
const path=process.env.RESOLVE_PROJECT;
if(!path || !/^(?:(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+|\.)$/.test(path))throw new Error('Invalid fixed package path');
const manager=process.env.RESOLVE_MANAGER||'pnpm';
if(!['pnpm','npm'].includes(manager))throw new Error('Unsupported fixed dependency manager');
const mode=process.env.RESOLVE_MODE||'resolve';
if(!['resolve','verify'].includes(mode)||(mode==='verify'&&manager!=='npm'))throw new Error('Unsupported fixed dependency operation');
mkdirSync('/work/home',{recursive:true});
const project=resolve('/work/project',path);
if(manager==='npm'){
 const require=createRequire('/usr/local/lib/node_modules/npm/package.json');
 mkdirSync(dirname(project),{recursive:true});
 stageNpmInputs(resolve('/source',path),project,mode,require('npm-package-arg'));
}else cpSync('/source','/work/project',{recursive:true});
const snapshot=()=>['package.json','pnpm-workspace.yaml'].map(name=>{
  const filename=resolve(project,name);
  return existsSync(filename)?createHash('sha256').update(readFileSync(filename)).digest('hex'):null;
});
const before=snapshot();
const lockBefore=mode==='verify'?createHash('sha256').update(readFileSync(resolve(project,'package-lock.json'))).digest('hex'):undefined;
let executable='corepack',args=['pnpm','install','--lockfile-only','--no-frozen-lockfile','--ignore-scripts','--ignore-pnpmfile'];
if(manager==='npm'){
 const version=spawnSync('npm',['--version'],{cwd:'/work',encoding:'utf8',timeout:10000,maxBuffer:4096});
 if(version.error||version.status!==0||version.stdout.trim()!=='11.19.1')throw new Error('The pinned npm toolchain changed');
 // Ignore repository configuration only in the disposable copy. No hooks,
 // alternate registries, user config, global config or workspace mutations.
 for(const config of ['/work/user.npmrc','/work/global.npmrc'])writeFileSync(config,'',{flag:'wx',mode:0o600});
 executable='npm';args=[...(mode==='verify'?['ci']:['install','--package-lock-only']),'--ignore-scripts','--no-audit','--no-fund','--workspaces=false','--registry=https://registry.npmjs.org/','--userconfig=/work/user.npmrc','--globalconfig=/work/global.npmrc','--cache=/work/npm-cache'];
}
const child=spawnSync(executable,args,{
  cwd:project,encoding:'utf8',maxBuffer:4_000_000,timeout:840_000,
});
if(child.stdout)process.stderr.write(child.stdout.slice(-12000));
if(child.stderr)process.stderr.write(child.stderr.slice(-12000));
if(child.error || child.status!==0){process.stderr.write('\nFixed package-manager resolution failed.\n');process.exit(1);}
if(JSON.stringify(before)!==JSON.stringify(snapshot()))throw new Error('Package manager changed manifest behavior');
const filename=resolve(project,manager==='npm'?'package-lock.json':'pnpm-lock.yaml');const stat=lstatSync(filename);
if(!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>2_000_000)throw new Error('Invalid generated lockfile');
const bytes=readFileSync(filename);new TextDecoder('utf-8',{fatal:true}).decode(bytes);
if(manager==='npm'){
 if(entryExists(resolve(project,'npm-shrinkwrap.json')))reject();
 const require=createRequire('/usr/local/lib/node_modules/npm/package.json');
 assertPublicNpmLock(npmJson(filename),require('npm-package-arg'));
}
if(mode==='verify'){
 if(createHash('sha256').update(bytes).digest('hex')!==lockBefore)throw new Error('Locked installation changed its source lockfile');
 process.stdout.write(JSON.stringify({npmLockVerified:true}));
}else process.stdout.write(bytes);
}
if(import.meta.main)main();
