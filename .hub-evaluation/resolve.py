"""Fixed dependency resolution only; never a build/deployment success receipt."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import signal
from runner import git, load_json, materialize, context_digest, clean, cleanup_container

# Lazy module loading can leave an explicitly required upgrade with only its
# /go.mod hash. Download the complete selected graph before retaining go.sum.
GO_RESOLUTION_COMMAND = 'mkdir -p /work/home /work/go-tmp; cp -R /source/. /work/project; cd /work/project; before=$(sha256sum go.mod); go mod download all >&2; test "$before" = "$(sha256sum go.mod)"; test ! -L go.sum; if test ! -e go.sum; then : > go.sum; fi; test -f go.sum; test "$(stat -c %h go.sum)" = 1; head -c 2000001 go.sum'

def capture(args, name):
    process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    chunks, diagnostic, overflow=[],bytearray(),threading.Event()
    def kill():
        try: os.killpg(process.pid,signal.SIGKILL)
        except ProcessLookupError: pass
    def read_stdout():
        size=0
        try:
            while True:
                chunk=process.stdout.read(4096)
                if not chunk: break
                size+=len(chunk)
                if size>2_000_000: overflow.set();kill();break
                chunks.append(chunk)
        except OSError: overflow.set();kill()
    def read_stderr():
        size=0
        try:
            while True:
                chunk=process.stderr.read(4096)
                if not chunk: break
                size+=len(chunk);diagnostic.extend(chunk);del diagnostic[:-24000]
                if size>4_000_000: overflow.set();kill();break
        except OSError: overflow.set();kill()
    readers=[threading.Thread(target=read_stdout,daemon=True),threading.Thread(target=read_stderr,daemon=True)]
    timer=threading.Timer(900,kill);timer.start()
    for reader in readers: reader.start()
    try:
        code=process.wait(timeout=910)
        for reader in readers: reader.join(timeout=10)
        if overflow.is_set() or any(reader.is_alive() for reader in readers): raise ValueError('Dependency output exceeded its limits')
        return code,b''.join(chunks),clean(diagnostic.decode('utf-8',errors='replace'))
    finally:
        timer.cancel()
        if process.poll() is None: kill()
        process.wait(timeout=10)
        process.stdout.close();process.stderr.close()
        cleanup_container(name,auto_remove=True)

def arguments(name,directory,image):
    return ['docker','run','--rm','--name',name,'--user','10001:10001','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
        '--memory','3g','--cpus','2','--pids-limit','256','--log-driver','json-file','--log-opt','max-size=4m','--log-opt','max-file=1',
        '--tmpfs','/work:rw,exec,nosuid,nodev,uid=10001,gid=10001,size=3g','--tmpfs','/tmp:rw,nosuid,nodev,size=256m',
        '--env','HOME=/work/home','--volume',str(directory)+':/source:ro']

def run():
    if sys.platform!='linux': raise ValueError('Ephemeral Linux runner required')
    head=git('rev-parse','HEAD').decode().strip();parent=git('rev-parse','HEAD^').decode().strip()
    if git('diff','--name-only',parent,head).decode().splitlines()!=['.hub-candidate.json']: raise ValueError('Trusted resolver changed')
    policy=load_json(git('show',parent+':.hub-evaluation/policy.json'))
    candidate=load_json(git('show',head+':.hub-candidate.json'));source=policy['sourceCommit']
    if not re.fullmatch('[a-f0-9]{40}',source): raise ValueError('Invalid source identity')
    run_id=int(os.environ['GITHUB_RUN_ID']);attempt=int(os.environ['GITHUB_RUN_ATTEMPT'])
    report={'version':1,'kind':'dependency-resolution','sourceCommit':source,'runnerCommit':parent,'inputDigest':candidate.get('digest'),
        'treeDigest':'0'*64,'head':head,'runId':run_id,'runAttempt':attempt,'passed':False,'files':[],'output':''}
    expected=[]
    if policy.get('goTests') and 'go.sum' in policy['writablePaths']: expected.append('go.sum')
    for project in policy.get('nodeProjects',[]):
        path=project['path']
        if project['manager']!='pnpm' or not re.fullmatch(r'(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+|[.]',path): raise ValueError('Invalid fixed package profile')
        lock=('' if path=='.' else path+'/')+'pnpm-lock.yaml'
        if lock in policy['writablePaths']: expected.append(lock)
    if not 1<=len(expected)<=10 or len(set(expected))!=len(expected) or sorted(policy.get('resolutionPaths',[]))!=sorted(expected): raise ValueError('Invalid fixed lockfile capabilities')
    for key,prefix in [('goImage','docker.io/library/golang@sha256:'),('nodeImage','docker.io/library/node@sha256:')]:
        if not re.fullmatch(re.escape(prefix)+'[a-f0-9]{64}',policy.get(key,'')): raise ValueError('Resolver image must be pinned')
    outputs=[]
    prefix='hub-prep-resolve-'+os.urandom(8).hex()
    with tempfile.TemporaryDirectory(prefix='hub-resolve-',dir=os.environ['RUNNER_TEMP']) as temporary:
        directory=Path(temporary)
        try:
            report['treeDigest']=materialize(source,candidate,policy['writablePaths'],directory)
            generated=[]
            if 'go.sum' in expected:
                name=prefix+'-go'
                args=arguments(name,directory,policy['goImage'])+['--env','GOPATH=/work/gopath','--env','GOCACHE=/work/gocache','--env','GOTMPDIR=/work/go-tmp','--env','GOTOOLCHAIN=local','--env','GOMAXPROCS=2',policy['goImage'],'sh','-ec',
                    GO_RESOLUTION_COMMAND]
                code,data,output=capture(args,name);outputs.append('Go lock resolution: exit '+str(code)+'\n'+output)
                if code: raise ValueError('Go lock resolution failed')
                generated.append({'path':'go.sum','content':data.decode('utf-8',errors='strict')})
            for index,project in enumerate(policy.get('nodeProjects',[])):
                lock=('' if project['path']=='.' else project['path']+'/')+'pnpm-lock.yaml'
                if lock not in expected: continue
                script=directory.parent/(prefix+'-node.mjs')
                if script.exists(): raise ValueError('Resolver wrapper staging collision')
                script.write_bytes(git('show',parent+':.hub-evaluation/resolve-node.mjs'));script.chmod(0o644)
                try:
                    name=prefix+'-node-'+str(index)
                    args=arguments(name,directory,policy['nodeImage'])+['--env','COREPACK_HOME=/work/corepack','--env','CI=true','--env','RESOLVE_PROJECT='+project['path'],'--volume',str(script)+':/hub-resolve.mjs:ro',policy['nodeImage'],'node','/hub-resolve.mjs']
                    code,data,output=capture(args,name);outputs.append('pnpm lock resolution '+project['path']+': exit '+str(code)+'\n'+output)
                    if code: raise ValueError('pnpm lock resolution failed')
                    generated.append({'path':lock,'content':data.decode('utf-8',errors='strict')})
                finally: script.unlink(missing_ok=True)
            if sum(len(f['content'].encode()) for f in generated)>2_000_000 or sorted(f['path'] for f in generated)!=sorted(expected): raise ValueError('Generated lockfiles exceeded capabilities')
            if context_digest(directory)!=report['treeDigest']: raise ValueError('Immutable dependency input changed')
            report['files']=generated;report['passed']=True
        except Exception as error:
            report['files']=[];outputs.append(clean(str(error))+'\nNo build or deployment verified.')
        finally:
            report['output']=clean('\n'.join(outputs))
            target=Path(os.environ['RUNNER_TEMP'])/f'hub-resolution-{run_id}-{attempt}.json'
            data=json.dumps(report,ensure_ascii=False).encode('utf-8')
            if len(data)>2_500_000: raise ValueError('Resolution report exceeded artifact limit')
            target.write_bytes(data)
    return 0 if report['passed'] else 1

if __name__=='__main__':
    try: sys.exit(run())
    except Exception:
        print('Isolated dependency resolver failed; no files accepted.',file=sys.stderr);sys.exit(1)
