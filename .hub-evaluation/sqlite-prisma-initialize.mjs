// Trusted initializer for a NEW, source-bound SQLite schema. It never updates a
// nonempty, unrecognized database or applies a changed schema to existing data.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, relative, sep, isAbsolute } from 'node:path';
import { lstatSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
// Deliberately support a small, unambiguous datasource grammar. Comment and
// string tokens must not be mistaken for an actual datasource declaration.
export function assertCanonicalPrismaSqliteDatasource(source) {
  if(typeof source!=='string'||Buffer.byteLength(source)>256*1024)fail('The Prisma schema exceeds its safe size.');
  const tokens=[];
  for(let i=0;i<source.length;) {
    if(/\s/.test(source[i])){i++;continue;}
    if(source.startsWith('//',i)){const end=source.indexOf('\n',i+2);i=end<0?source.length:end;continue;}
    if(source.startsWith('/*',i)){const end=source.indexOf('*/',i+2);if(end<0)fail('Invalid Prisma schema comment.');i=end+2;continue;}
    if(source[i]==='"') {
      const start=i++;let closed=false;
      while(i<source.length){if(source[i]==='\\'){i+=2;continue;}if(source[i++]==='"'){closed=true;break;}}
      if(!closed)fail('Invalid Prisma schema string.');
      let value;try{value=JSON.parse(source.slice(start,i));}catch{fail('Invalid Prisma schema string.');}
      tokens.push({value,string:true});continue;
    }
    const identifier=source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if(identifier){tokens.push({value:identifier,string:false});i+=identifier.length;}
    else tokens.push({value:source[i++],string:false});
  }
  const matches=(token,value,string=false)=>token?.value===value&&token.string===string;
  let depth=0,count=0;
  for(let i=0;i<tokens.length;i++) {
    if(depth===0&&matches(tokens[i],'datasource')) {
      if(++count!==1 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tokens[++i]?.value || '') || tokens[i].string || !matches(tokens[++i],'{'))fail('A single explicit Prisma datasource is required.');
      const seen=new Set();i++;
      while(i<tokens.length&&!matches(tokens[i],'}')) {
        const key=tokens[i++];
        if(key.string||!['provider','url','relationMode'].includes(key.value)||seen.has(key.value)||!matches(tokens[i++],'='))fail('Unsupported Prisma datasource configuration.');
        seen.add(key.value);
        if(key.value==='provider'){if(!matches(tokens[i++],'sqlite',true))fail('Initialization supports only a SQLite Prisma datasource.');}
        else if(key.value==='url') {
          if(!matches(tokens[i++],'env')||!matches(tokens[i++],'(')||!matches(tokens[i++],'DATABASE_URL',true)||!matches(tokens[i++],')'))fail('The Prisma datasource must use env("DATABASE_URL") for the managed canonical database.');
        } else if(!tokens[i]?.string||!['prisma','foreignKeys'].includes(tokens[i++].value))fail('Unsupported Prisma relation mode.');
      }
      if(!matches(tokens[i],'}')||!seen.has('provider')||!seen.has('url'))fail('A complete Prisma SQLite datasource is required.');
    } else if(matches(tokens[i],'{'))depth++;
    else if(matches(tokens[i],'}')&&--depth<0)fail('Invalid Prisma schema block.');
  }
  if(count!==1||depth!==0)fail('A single explicit Prisma datasource is required.');
}
function boundedFile(path, limit) {
  const stat=lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size>limit) fail('Schema initialization requires bounded regular files.');
  return readFileSync(path);
}
function optionalStat(path) {
  try{return lstatSync(path);}catch(error){if(error.code==='ENOENT')return undefined;throw error;}
}
function regularPath(root, child) {
  let current=root;
  for (const part of child.split('/')) {
    current=join(current,part);
    if(lstatSync(current).isSymbolicLink()) fail('Schema initialization paths cannot contain symbolic links.');
  }
  return current;
}

export function initializePrismaSqlite(contract, dependencies = {}) {
  if (!contract || typeof contract.schema!=='string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*[.]prisma$/.test(contract.schema)
      || contract.schema.split('/').some(p=>p==='.'||p==='..') || contract.schema.length>140 || !/^[a-f0-9]{64}$/.test(contract.sha256 || ''))
    fail('The SQLite initialization contract is invalid.');
  if(!contract.client || typeof contract.client.path!=='string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*[.][cm]?[jt]sx?$/.test(contract.client.path)
      || contract.client.path.split('/').some(p=>p==='.'||p==='..') || contract.client.path.length>140 || !/^[a-f0-9]{64}$/.test(contract.client.sha256||''))fail('The default Prisma client contract is invalid.');
  // Production callers supply no dependencies. Overrides are only for the same
  // implementation's filesystem/SQLite regression tests, never request input.
  const appRoot=dependencies.appRoot || '/app', dataRoot=dependencies.dataRoot || '/app/.data';
  if(lstatSync(dataRoot).isSymbolicLink() || !lstatSync(dataRoot).isDirectory()) fail('Managed SQLite storage is unavailable.');
  const schema=regularPath(appRoot,contract.schema), source=boundedFile(schema,256*1024);
  if(hash(source)!==contract.sha256) fail('The built Prisma schema differs from the verified source.');
  assertCanonicalPrismaSqliteDatasource(source.toString('utf8'));
  if(hash(boundedFile(regularPath(appRoot,contract.client.path),128*1024))!==contract.client.sha256)fail('The built Prisma client module differs from the verified default client source.');
  const environment=dependencies.environment || process.env;
  if(environment.DATABASE_URL!=='file:'+join(dataRoot,'application.sqlite'))
    fail('DATABASE_URL must resolve to the managed canonical SQLite database.');
  const prisma = dependencies.runPrisma || ((args) => {
    let directory=dirname(schema), cli;
    while(directory===appRoot || relative(appRoot,directory) && relative(appRoot,directory)!=='..' && !isAbsolute(relative(appRoot,directory)) && !relative(appRoot,directory).startsWith('..'+sep)) {
      const packageFile=join(directory,'node_modules/prisma/package.json');
      if(existsSync(packageFile)) {
        const pkg=JSON.parse(boundedFile(packageFile,128*1024).toString('utf8'));
        if(!/^6[.]/.test(pkg.version || '')) fail('This initialization contract requires Prisma 6.');
        cli=join(directory,'node_modules/prisma/build/index.js');break;
      }
      if(directory===appRoot)break;directory=dirname(directory);
    }
    if(!cli)fail('The built image must include its supported Prisma CLI.');
    try { return execFileSync(process.execPath,[cli,...args],{cwd:dirname(schema),encoding:'utf8',timeout:60000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}); }
    catch { fail('The isolated Prisma schema check failed. No database upgrade was authorized.'); }
  });
  const sql=prisma(['migrate','diff','--from-empty','--to-schema-datamodel',schema,'--script']);
  if(typeof sql!=='string' || Buffer.byteLength(sql)>1024*1024 || !sql.trim()) fail('The initial schema SQL is unavailable or exceeds its limit.');
  const receipt={version:1,schema:contract.schema,sourceSha256:contract.sha256,client:contract.client,sqlSha256:hash(sql)};
  const database=join(dataRoot,'application.sqlite'), marker=join(dataRoot,'.hub-prisma-initial.json');
  const databaseInfo=optionalStat(database),markerInfo=optionalStat(marker);
  if(databaseInfo && (databaseInfo.isSymbolicLink() || !databaseInfo.isFile())) fail('The managed database path is unsafe.');
  if(markerInfo) {
    const saved=JSON.parse(boundedFile(marker,2048).toString('utf8'));
    if(JSON.stringify(saved)!==JSON.stringify(receipt)) fail('The schema changed. A reviewed production migration is required before deployment.');
    if(!existsSync(database)) fail('The initialized database is missing; recovery is required.');
    const db=new DatabaseSync(database,{readOnly:true});
    try { if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') fail('The managed database integrity check failed.'); }
    finally { db.close(); }
    // Exit-code checking independently compares the actual persisted schema.
    prisma(['migrate','diff','--from-url','file:'+database,'--to-schema-datamodel',schema,'--exit-code']);
    return {initialized:false,unchangedSchemaVerified:true};
  }
  const db=new DatabaseSync(database);
  try {
    db.exec('PRAGMA synchronous=FULL');
    const tables=db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'").get().n;
    if(tables!==0) fail('The database is not empty and has no initialization receipt. Existing data requires reviewed recovery or migration.');
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(sql);db.exec('COMMIT'); }
    catch { try{db.exec('ROLLBACK');}catch{} fail('Initial database creation failed. Existing data was not reset.'); }
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') fail('Initial database integrity verification failed.');
  } finally { db.close(); }
  // The enclosing release journal/snapshot owns rollback if persistence fails
  // between the DB commit and receipt publication. A retry never treats a
  // nonempty unrecognized DB as permission to reset or recreate it.
  const temporary=join(dataRoot,'.hub-prisma-initial-'+randomUUID()+'.json');
  let fd;
  try {
    fd=openSync(temporary,'wx',0o600);writeFileSync(fd,JSON.stringify(receipt));fsyncSync(fd);closeSync(fd);fd=undefined;
    renameSync(temporary,marker);
    if(process.platform!=='win32'){const directory=openSync(dataRoot,'r');try{fsyncSync(directory);}finally{closeSync(directory);}}
  } finally { if(fd!==undefined)closeSync(fd);if(existsSync(temporary))unlinkSync(temporary); }
  return {initialized:true,unchangedSchemaVerified:true};
}
