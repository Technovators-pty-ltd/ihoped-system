"""Trusted ephemeral Linux runner. Application commands execute in containers only.

Installed beside an operator-pinned policy before Pi receives the repository.
The candidate commit can change only .hub-candidate.json. No deployment occurs.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import urllib.error
import urllib.request
import yaml

GATES = ['tests', 'image_build', 'source_scan', 'image_scan', 'runtime_health']
SCANNER = 'aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c'
REPORT = Path(os.environ.get('RUNNER_TEMP', tempfile.gettempdir())) / 'hub-preparation-report.json'
SECRET_VALUES = []
TEST_ENVIRONMENT = {}
RUNTIME_TMPFS = {'/tmp': 'rw,nosuid,nodev,size=64m', '/app/.data': 'rw,nosuid,nodev,uid=10001,gid=10001,size=256m'}
RUNTIME_LOG_CONFIG = {'Type':'json-file','Config':{'max-size':'4m','max-file':'1'}}

def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result: raise ValueError('Duplicate JSON key')
        result[key] = value
    return result

def load_json(data):
    if len(data) > 2_500_000: raise ValueError('JSON input exceeds limit')
    return json.loads(data, object_pairs_hook=unique_object)

def compact(data):
    return json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')

def git(*args):
    return subprocess.check_output(['git', *args], timeout=30)

def clean(text):
    text = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', text)
    text = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', text)
    for value in SECRET_VALUES: text = text.replace(value, '[redacted]')
    text = re.sub(r'(?i)(?:bearer\s+|(?:password|api[_-]?key|access[_-]?token)\s*[:=]\s*)[^\s\"\']+', '[redacted]', text)
    text = re.sub(r'\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+)\b', '[redacted]', text)
    return text.encode('utf-8')[-20000:].decode('utf-8', errors='ignore')

def assert_image_storage(volumes):
    # Service-supplied tmpfs mounts need no image VOLUME declarations. Reject all
    # declarations, including inherited ones, before any application can start.
    if volumes is not None and volumes != {}: raise ValueError('Image-declared volumes are unavailable; use /tmp and /app/.data without VOLUME')

def assert_runtime_storage(storage):
    if not isinstance(storage, dict) or storage.get('readonly') is not True or storage.get('tmpfs') != RUNTIME_TMPFS or storage.get('binds') not in [None, []] or storage.get('logs') != RUNTIME_LOG_CONFIG:
        raise ValueError('Runtime storage contract changed')
    mounts = storage.get('mounts')
    if not isinstance(mounts, list) or len(mounts) > 2: raise ValueError('Unexpected runtime mount list')
    destinations = set()
    for mount in mounts:
        if not isinstance(mount, dict) or mount.get('Type') != 'tmpfs' or mount.get('Destination') not in RUNTIME_TMPFS or mount.get('Source') not in [None, ''] or mount.get('RW') is not True or mount.get('Destination') in destinations:
            raise ValueError('Unexpected writable runtime mount')
        destinations.add(mount['Destination'])
    # Docker versions differ in whether legacy --tmpfs entries also appear in
    # Mounts. HostConfig.Tmpfs above must always contain both exact bounded mounts.

def cleanup_container(name, *, auto_remove=False):
    inspected = None
    volumes = set()
    inventory_failed = False
    try:
        inspected = subprocess.run(['docker', 'inspect', '--format={{json .Mounts}}', name], capture_output=True, timeout=30)
        if inspected.returncode == 0:
            mounts = load_json(inspected.stdout)
            if not isinstance(mounts, list): raise ValueError('Invalid mount inventory')
            for mount in mounts:
                if mount.get('Type') == 'volume':
                    volume = mount.get('Name', '')
                    if not re.fullmatch('[a-f0-9]{64}', volume): raise ValueError('Unexpected named volume')
                    volumes.add(volume)
    except (ValueError, TypeError, AttributeError, OSError, subprocess.SubprocessError): inventory_failed = True
    # Only this exact task-owned container is removed; -v removes its anonymous
    # volumes. Never prune global volumes or delete unrelated named storage.
    removed = subprocess.run(['docker', 'rm', '-f', '-v', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
    remaining = subprocess.run(['docker', 'ps', '-aq', '--filter', 'name=^/'+name+'$'], capture_output=True, timeout=30)
    if remaining.returncode or remaining.stdout.strip(): raise RuntimeError('Test container cleanup could not be verified')
    for volume in volumes:
        remaining = subprocess.run(['docker', 'volume', 'ls', '--quiet', '--filter', 'name='+volume], capture_output=True, timeout=30)
        if remaining.returncode or remaining.stdout.strip(): raise RuntimeError('Test anonymous-volume cleanup could not be verified')
    # Foreground test containers are launched with --rm: Docker may have already
    # removed the container and its anonymous volumes before this inspection.
    # The stopped/started runtime has no --rm and must always be inventoried.
    if inventory_failed or (inspected is not None and inspected.returncode != 0 and not auto_remove):
        raise RuntimeError('Test container removed, but its volume inventory could not be verified')

def command(args, seconds=600, container=None):
    """Bound wall time AND output; clean the exact test container on every exit."""
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
    def kill():
        try: os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError: pass
    timer = threading.Timer(seconds, kill)
    timer.start()
    tail, total = b'', 0
    try:
        while True:
            chunk = process.stdout.read(4096)
            if not chunk: break
            total += len(chunk)
            tail = (tail + chunk)[-24000:]
            if total > 4_000_000: kill()
        code = process.wait(timeout=10)
        if total > 4_000_000: code = 125
        return code, clean(tail.decode('utf-8', errors='replace'))
    finally:
        timer.cancel()
        if process.poll() is None: kill()
        if container: cleanup_container(container, auto_remove=True)

def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def context_digest(directory):
    entries = []
    for path in directory.rglob('*'):
        if path.is_symlink(): raise ValueError('Symlink in materialized source')
        if path.is_file():
            if path.stat().st_nlink != 1: raise ValueError('Hardlink in materialized source')
            entries.append([path.relative_to(directory).as_posix(), '100755' if path.stat().st_mode & 0o111 else '100644', blob(path.read_bytes())])
    entries.sort(key=lambda e: e[0].encode('utf-8'))
    return hashlib.sha256(compact(entries)).hexdigest()

def materialize_source(source, directory):
    if not re.fullmatch("[a-f0-9]{40}", source): raise ValueError("Invalid immutable source revision")
    # git archive normally honors export-ignore/export-subst. Disable both in this
    # task-owned checkout's metadata so the context is the exact committed bytes.
    git_directory = Path(git('rev-parse', '--absolute-git-dir').decode().strip()).resolve()
    attributes = Path(git('rev-parse', '--path-format=absolute', '--git-path', 'info/attributes').decode().strip())
    if attributes.parent.resolve().parent != git_directory or attributes.is_symlink(): raise ValueError('Unsafe checkout attributes path')
    attributes.parent.mkdir(exist_ok=True)
    attributes.write_text('* -export-ignore -export-subst\n', encoding='ascii')
    total = 0
    checkout = git('rev-parse', '--show-toplevel').decode().strip()
    archive = subprocess.Popen(['git', 'archive', '--format=tar', source], cwd=checkout, stdout=subprocess.PIPE, start_new_session=True)
    deadline = threading.Timer(60, lambda: archive.kill() if archive.poll() is None else None)
    deadline.start()
    try:
        with tarfile.open(fileobj=archive.stdout, mode='r|') as tar:
            for entry in tar:
                path = Path(entry.name)
                if path.is_absolute() or '..' in path.parts or '.git' in path.parts: raise ValueError('Unsafe source path')
                if entry.isdir(): continue
                if not entry.isfile() or entry.size > 16_000_000: raise ValueError('Unsupported source entry')
                total += entry.size
                if total > 100_000_000: raise ValueError('Source materialization exceeds limit')
                target = directory / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(tar.extractfile(entry).read())
                target.chmod(0o755 if entry.mode & 0o111 else 0o644)
        if archive.wait(timeout=10): raise ValueError('Source archive failed')
    finally:
        deadline.cancel()
        archive.stdout.close()
        if archive.poll() is None: archive.kill()
        archive.wait(timeout=10)
    directory.chmod(0o755)
    for path in directory.rglob("*"):
        if path.is_dir(): path.chmod(0o755)

def materialize(source, candidate, allowed, directory):
    if candidate.get('sourceCommit') != source or set(candidate) != {'sourceCommit', 'digest', 'files'}: raise ValueError('Candidate source mismatch')
    files = candidate['files']
    if not isinstance(files, list) or not 1 <= len(files) <= 40: raise ValueError('Candidate count invalid')
    paths = set()
    for file in files:
        if set(file) != {'path', 'content'} or file['path'] not in allowed or file['path'] in paths or not isinstance(file['content'], str): raise ValueError('Candidate capability mismatch')
        paths.add(file['path'])
    if sum(len(f['content'].encode()) for f in files) > 2_000_000: raise ValueError('Candidate bytes exceed limit')
    canonical = {'sourceCommit': source, 'files': sorted(files, key=lambda f: f['path'])}
    if hashlib.sha256(compact(canonical)).hexdigest() != candidate['digest']: raise ValueError('Candidate digest mismatch')
    materialize_source(source, directory)
    for file in files:
        path = Path(file['path'])
        if path.is_absolute() or '..' in path.parts or '.git' in path.parts: raise ValueError('Unsafe candidate path')
        target = directory / path
        assert_manifest_change(file['path'], target.read_text(encoding='utf-8') if target.is_file() and (file['path'].endswith('package.json') or file['path'].endswith('pnpm-workspace.yaml')) else None, file['content'])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(file['content'], encoding='utf-8', newline='')
        target.chmod(0o644)
    # UID10001 in read-only test containers needs traverse/read access, never host credentials.
    directory.chmod(0o755)
    for path in directory.rglob('*'):
        if path.is_dir(): path.chmod(0o755)
    return context_digest(directory)

def assert_manifest_change(path, original, proposed):
    if path.endswith('package.json'):
        before = load_json(original or '{}'); after = load_json(proposed)
        keys = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
        if {k:v for k,v in before.items() if k not in keys} != {k:v for k,v in after.items() if k not in keys}: raise ValueError('Application manifest behavior changed')
        for key in keys:
            if set(before.get(key, {})) != set(after.get(key, {})): raise ValueError('Application dependency names changed')
    elif path.endswith('pnpm-workspace.yaml'):
        for text in [original or '{}', proposed]:
            if len(text.encode()) > 128000 or any(isinstance(token, (yaml.tokens.AnchorToken, yaml.tokens.AliasToken, yaml.tokens.TagToken)) for token in yaml.scan(text)): raise ValueError('Unsupported workspace manifest')
        before = yaml.safe_load(original or '{}'); after = yaml.safe_load(proposed)
        if not isinstance(before, dict) or not isinstance(after, dict) or {k:v for k,v in before.items() if k != 'overrides'} != {k:v for k,v in after.items() if k != 'overrides'}: raise ValueError('Workspace execution settings changed')

def docker_instructions(text):
    result, pending = [], ''
    for raw in text.split('\n'):
        line = raw.removesuffix('\r').rstrip(' \t')
        if not line.strip() or re.match(r'^[ \t]*#', line): continue
        if line.endswith('\\'):
            pending += line[:-1]
            continue
        logical = (pending+line).strip(' \t')
        pending = ''
        instruction = re.fullmatch(r'([A-Za-z]+)(?:[ \t]+(.*))?', logical)
        if not instruction: raise ValueError('Unsupported logical Dockerfile instruction')
        result.append((instruction[1].upper(), instruction[2] or ''))
    if pending: raise ValueError('Unterminated Dockerfile continuation')
    return result


def assert_dockerfile(text, policy):
    if len(text.encode()) > 64000 or '<<' in text or re.search(r'^[ \t]*#[ \t]*(?:syntax|escape)[ \t]*=', text, re.I|re.M) or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', text) or '\r' in text.replace('\r\n', ''):
        raise ValueError('Unsupported Dockerfile frontend, heredoc or control character')
    images = {policy['goImage'], policy['nodeImage'], policy['alpineImage'], 'scratch'}
    count, stages = 0, {}
    names = {'ARG','FROM','RUN','CMD','LABEL','EXPOSE','ENV','ADD','COPY','ENTRYPOINT','VOLUME','USER','WORKDIR','STOPSIGNAL','HEALTHCHECK','SHELL','MAINTAINER'}
    for name, args in docker_instructions(text):
        if name not in names: raise ValueError('Unsupported Dockerfile instruction, including ONBUILD triggers')
        if name == 'FROM':
            instruction = re.fullmatch(r'([A-Za-z0-9@:/._-]+)(?:[ \t]+AS[ \t]+([A-Za-z][A-Za-z0-9_-]*))?', args, re.I)
            if not instruction or instruction[1] not in images: raise ValueError('Unapproved Dockerfile base image')
            if instruction[2]:
                stage = instruction[2].lower()
                if stage in stages: raise ValueError('Duplicate Dockerfile stage')
                stages[stage] = count
            count += 1
        elif name == 'RUN' and args.startswith('--'):
            raise ValueError('RUN flags and mounts are unavailable in preparation recipes')
        elif name in ['COPY','ADD']:
            remaining, flags = args, set()
            while remaining.startswith('--'):
                flag = re.match(r'--([a-z]+(?:-[a-z]+)*)(?:=([^ \t]+))?(?:[ \t]+|$)', remaining)
                if not flag or flag[1] in flags: raise ValueError('Unsupported or duplicate file-copy flag')
                flags.add(flag[1])
                if flag[1] == 'from':
                    value = flag[2] or ''
                    index = int(value) if re.fullmatch(r'0|[1-9][0-9]*', value) else stages.get(value.lower())
                    if name != 'COPY' or index is None or not 0 <= index < count-1: raise ValueError('COPY --from requires a previous build stage, not an external image')
                elif flag[1] in ['link','parents']:
                    if flag[2] and flag[2] not in ['true','false']: raise ValueError('Invalid boolean file-copy flag')
                elif flag[1] not in ['chown','chmod','exclude','checksum'] or not flag[2] or not re.fullmatch(r'[A-Za-z0-9_.$:/@*?+!-]+', flag[2]):
                    raise ValueError('Unsupported file-copy flag')
                remaining = remaining[flag.end():]
    if not count: raise ValueError('Dockerfile has no FROM instruction')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args): return None

def runtime_probe(opener, origin, probe):
    """Project-specific acceptance predicates are pinned harness data, not Pi output."""
    if probe.get('method') not in ['GET', 'POST'] or not isinstance(probe.get('path'), str) or len(probe['path']) > 200 or not re.fullmatch('/[A-Za-z0-9/_.-]*', probe['path']): raise ValueError('Invalid trusted runtime probe')
    def request_data(value):
        if isinstance(value, dict):
            if '$env' in value:
                if set(value) != {'$env'} or value['$env'] not in TEST_ENVIRONMENT: raise ValueError('Runtime probe requested an undeclared synthetic setting')
                return TEST_ENVIRONMENT[value['$env']]
            return {key: request_data(child) for key, child in value.items()}
        if isinstance(value, list): return [request_data(child) for child in value]
        return value
    body = compact(request_data(probe.get('body', {}))) if probe['method'] == 'POST' else None
    if body is not None and len(body) > 4096: raise ValueError('Runtime probe request exceeds limit')
    request = urllib.request.Request(origin+probe['path'], data=body, method=probe['method'], headers={'Content-Type':'application/json'})
    try: response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as error: response = error
    with response:
        if response.status != probe.get('status', 200): raise ValueError('Runtime acceptance status failed')
        data = response.read(128001)
    if len(data) > 128000: raise ValueError('Runtime acceptance response exceeds limit')
    fields = probe.get('fields', [])
    if not isinstance(fields, list) or len(fields) > 16: raise ValueError('Runtime acceptance field limit')
    if fields:
        value = load_json(data)
        missing = object()
        for field in fields:
            path = field.get('path')
            if not isinstance(path, list) or not 1 <= len(path) <= 8 or not all(isinstance(p,str) for p in path): raise ValueError('Invalid runtime acceptance field path')
            selected = value
            for part in path:
                selected = selected.get(part, missing) if isinstance(selected, dict) else missing
            if selected is missing: selected = field.get('missing', missing)
            if selected is missing or type(selected) is not type(field.get('equals')) or selected != field.get('equals'): raise ValueError('Runtime acceptance field failed')

SQLITE_INSPECTION_SCRIPT = """import{openSync,closeSync,readSync,fstatSync,constants as c}from'node:fs';
const descriptors=[];try{
descriptors.push(openSync('/proc/1/root',c.O_RDONLY|c.O_DIRECTORY));
for(const part of ['app','.data'])descriptors.push(openSync('/proc/self/fd/'+descriptors.at(-1)+'/'+part,c.O_RDONLY|c.O_DIRECTORY|c.O_NOFOLLOW));
const file=openSync('/proc/self/fd/'+descriptors.at(-1)+'/application.sqlite',c.O_RDONLY|c.O_NOFOLLOW|c.O_NONBLOCK);descriptors.push(file);
const info=fstatSync(file),header=Buffer.alloc(16);
if(!info.isFile()||info.size<16||info.size>16000000||readSync(file,header,0,16,0)!==16||!header.equals(Buffer.from('53514c69746520666f726d6174203300','hex')))throw Error('Invalid canonical database');
console.log(JSON.stringify({canonicalSqlite:true,bytes:info.size}));
}catch{console.error('Canonical SQLite file is missing, linked, oversized or invalid.');process.exitCode=1;}
finally{for(const descriptor of descriptors.reverse())closeSync(descriptor);}
"""

def assert_sqlite_runtime(name, node_image):
    if not re.fullmatch('hub-[a-z0-9-]{1,100}', name) or not re.fullmatch('docker.io/library/node@sha256:[a-f0-9]{64}', node_image):
        raise ValueError('Invalid trusted SQLite inspection scope')
    # docker cp does not expose this live tmpfs mount. A fixed trusted reader
    # joins only the target PID namespace; it has no host/source/data mounts,
    # network or application credentials and opens the canonical file read-only.
    code,_=command(['docker','pull',node_image],180)
    if code: raise ValueError('Trusted SQLite inspection image unavailable')
    reader=name+'-sqlite-inspection'
    code,output=command(['docker','run','--rm','--pull=never','--name',reader,'--pid=container:'+name,'--user','0:0',
        '--network','none','--read-only','--cap-drop','ALL','--cap-add','SYS_PTRACE','--security-opt','no-new-privileges',
        '--memory','128m','--cpus','0.5','--pids-limit','32','--log-driver','json-file','--log-opt','max-size=1m','--log-opt','max-file=1',
        node_image,'node','--input-type=module','-e',SQLITE_INSPECTION_SCRIPT],45,reader)
    if code: raise ValueError('Canonical SQLite file is missing, linked, oversized or invalid; configure /app/.data/application.sqlite')
    report=load_json(output)
    if not isinstance(report,dict) or set(report)!={'canonicalSqlite','bytes'} or report['canonicalSqlite'] is not True or type(report['bytes']) is not int or not 16<=report['bytes']<=16_000_000:
        raise ValueError('Trusted SQLite inspection returned an invalid result')


def run_source_tests(directory, policy, prefix, step):
    # A generic fixed profile derived from the ORIGINAL manifests, not a command from Pi.
    if policy.get('goTests'):
        # Module cache, compiler cache and temporary archives coexist during a
        # cold pure-Go SQLite build. Keep the work area bounded, with headroom
        # above the old 2 GiB ceiling, and disallow additional container swap.
        name = prefix + '-go'
        environment = policy.get('goEnvironment', {})
        if environment not in [{}, {'DRIVER': 'sqlite'}]: raise ValueError('Unsupported independent Go test environment')
        extra = [arg for key,value in environment.items() for arg in ['--env', key+'='+value]]
        step('Go tests', ['docker', 'run', '--rm', '--log-driver', 'json-file', '--log-opt', 'max-size=4m', '--log-opt', 'max-file=1', '--name', name, '--user', '10001:10001', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--memory', '6g', '--memory-swap', '6g', '--cpus', '2', '--pids-limit', '256', '--tmpfs', '/work:rw,exec,nosuid,nodev,uid=10001,gid=10001,size=4g', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m', '--env', 'HOME=/work/home', '--env', 'GOPATH=/work/gopath', '--env', 'GOCACHE=/work/gocache', '--env', 'GOTMPDIR=/work/go-tmp', '--env', 'GOTOOLCHAIN=local', '--env', 'GOMAXPROCS=2', '--volume', f'{directory}:/source:ro', *extra, policy['goImage'], 'sh', '-ec', 'mkdir -p /work/home /work/go-tmp; cp -R /source/. /work/project; cd /work/project; go test ./...'], 900, name)
    for i, project in enumerate(policy.get('nodeProjects', [])):
        path = project['path']
        if not re.fullmatch(r'(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+|[.]', path): raise ValueError('Invalid package path')
        if project['manager'] != 'pnpm': raise ValueError('This fixed verification profile currently requires pnpm')
        name = prefix + '-node-' + str(i)
        step('Node tests', ['docker', 'run', '--rm', '--log-driver', 'json-file', '--log-opt', 'max-size=4m', '--log-opt', 'max-file=1', '--name', name, '--user', '10001:10001', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--memory', '3g', '--cpus', '2', '--pids-limit', '256', '--tmpfs', '/work:rw,exec,nosuid,nodev,uid=10001,gid=10001,size=3g', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m', '--env', 'HOME=/work/home', '--env', 'COREPACK_HOME=/work/corepack', '--volume', f'{directory}:/source:ro', '--workdir', '/work', policy['nodeImage'], 'sh', '-ec', f'mkdir -p /work/home; cp -R /source/. /work/project; cd /work/project/{path}; corepack pnpm install --frozen-lockfile; corepack pnpm test; corepack pnpm run build'], 900, name)
    if not policy.get('goTests') and not policy.get('nodeProjects'): raise ValueError('No independent tests configured')


def run():
    if sys.platform != 'linux': raise ValueError('Ephemeral Linux runner required')
    head = git('rev-parse', 'HEAD').decode().strip()
    parent = git('rev-parse', 'HEAD^').decode().strip()
    if git('diff', '--name-only', parent, head).decode().splitlines() != ['.hub-candidate.json']: raise ValueError('Candidate modified trusted runner files')
    policy = load_json(git('show', f'{parent}:.hub-evaluation/policy.json'))
    candidate = load_json(git('show', f'{head}:.hub-candidate.json'))
    source = policy['sourceCommit']
    if not re.fullmatch('[a-f0-9]{40}', source): raise ValueError('Invalid source commit')
    for key, prefix in [('goImage', 'docker.io/library/golang@sha256:'), ('nodeImage', 'docker.io/library/node@sha256:'), ('alpineImage', 'docker.io/library/alpine@sha256:'), ('builderImage', 'docker.io/moby/buildkit@sha256:')]:
        if not isinstance(policy.get(key), str) or not re.fullmatch(re.escape(prefix)+'[a-f0-9]{64}', policy[key]): raise ValueError('Verification images must be pinned approved tools')
    report = {'version': 1, 'sourceCommit': source, 'runnerCommit': parent, 'candidateDigest': candidate.get('digest'),
              'treeDigest': '0'*64, 'imageId': None, 'head': head, 'runId': int(os.environ['GITHUB_RUN_ID']),
              'runAttempt': int(os.environ['GITHUB_RUN_ATTEMPT']), 'gates': dict.fromkeys(GATES, 'not_run'), 'output': ''}
    prefix = 'hub-prep-' + secrets.token_hex(8)
    builder = prefix + '-builder'
    image = prefix + ':candidate'
    outputs = []
    def step(name, args, seconds=600, container=None):
        code, output = command(args, seconds, container)
        outputs.append(f'{name}: exit {code}\n{output}')
        if code: raise RuntimeError(f'{name} failed')
        return output
    with tempfile.TemporaryDirectory(prefix='hub-source-', dir=os.environ['RUNNER_TEMP']) as temporary:
        directory = Path(temporary)
        try:
            report['treeDigest'] = materialize(source, candidate, policy['writablePaths'], directory)
            expected = report['treeDigest']
            assert_dockerfile((directory/'Dockerfile').read_text(encoding='utf-8'), policy)
            run_source_tests(directory, policy, prefix, step)
            report['gates']['tests'] = 'passed'
            step('Start limited builder', ['docker', 'buildx', 'create', '--name', builder, '--driver', 'docker-container', '--driver-opt', 'memory=4g', '--driver-opt', 'cpu-quota=200000', '--driver-opt', 'cpu-period=100000', '--driver-opt', 'image='+policy['builderImage'], '--use'], 90)
            step('Build image', ['docker', 'buildx', 'build', '--builder', builder, '--pull', '--load', '--file', str(directory/'Dockerfile'), '--tag', image, str(directory)], 1200)
            image_id = step('Inspect built image', ['docker', 'image', 'inspect', '--format={{.Id}}', image], 30).strip()
            if not re.fullmatch('sha256:[a-f0-9]{64}', image_id): raise ValueError('Invalid immutable built image')
            report['imageId'] = image_id
            assert_image_storage(load_json(step('Inspect image storage declarations', ['docker', 'image', 'inspect', '--format={{json .Config.Volumes}}', image_id], 30)))
            report['gates']['image_build'] = 'passed'
            cache = directory.parent / (prefix + '-scanner')
            cache.mkdir(mode=0o777)
            scanner_policy = directory.parent / (prefix + '-policy')
            scanner_policy.mkdir(mode=0o755)
            (scanner_policy/'config.yaml').write_text('{}\n')
            (scanner_policy/'ignore').write_text('')
            name = prefix+'-db'
            step('Prepare scanner database', ['docker', 'run', '--rm', '--log-driver', 'json-file', '--log-opt', 'max-size=4m', '--log-opt', 'max-file=1', '--name', name, '--user', str(os.getuid())+':'+str(os.getgid()), '--memory', '1536m', '--cpus', '2', '--pids-limit', '128', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--volume', f'{cache}:/cache', SCANNER, '--cache-dir', '/cache', 'image', '--download-db-only', '--skip-version-check', '--disable-telemetry'], 300, name)
            common = ['docker', 'run', '--rm', '--log-driver', 'json-file', '--log-opt', 'max-size=4m', '--log-opt', 'max-file=1', '--user', str(os.getuid())+':'+str(os.getgid()), '--memory', '1536m', '--cpus', '2', '--pids-limit', '128', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--tmpfs', '/tmp:rw,nosuid,nodev,size=512m', '--volume', f'{cache}:/cache', '--volume', f'{scanner_policy}:/policy:ro']
            scan = ['--offline-scan', '--skip-db-update', '--skip-java-db-update', '--skip-version-check', '--disable-telemetry', '--scanners', 'vuln', '--severity', 'HIGH,CRITICAL', '--exit-code', '1', '--timeout', '10m', '--ignorefile', '/policy/ignore']
            name = prefix+'-source-scan'
            step('Source scan', common + ['--name', name, '--volume', f'{directory}:/repo:ro', SCANNER, '--cache-dir', '/cache', '--config', '/policy/config.yaml', 'fs', *scan, '/repo'], 660, name)
            report['gates']['source_scan'] = 'passed'
            image_tar = directory.parent / (prefix + '-image.tar')
            step('Save built image', ['docker', 'save', image_id, '--output', str(image_tar)], 120)
            name = prefix+'-image-scan'
            step('Image scan', common + ['--name', name, '--volume', f'{image_tar}:/scan/image.tar:ro', SCANNER, '--cache-dir', '/cache', '--config', '/policy/config.yaml', 'image', '--input', '/scan/image.tar', *scan], 660, name)
            report['gates']['image_scan'] = 'passed'
            plan = load_json((directory/'technovators.deploy.json').read_bytes())
            if not {'port', 'healthPath', 'requiredEnvironment'} <= set(plan) or set(plan) - {'port', 'healthPath', 'requiredEnvironment', 'storage', 'composeApplication', 'composeDataPath'}: raise ValueError('Invalid deployment contract fields')
            if type(plan['port']) is not int or not 1024 <= plan['port'] <= 65535 or not isinstance(plan['healthPath'], str) or len(plan['healthPath']) > 100 or not re.fullmatch('/[A-Za-z0-9/_-]*', plan['healthPath']): raise ValueError('Invalid runtime health contract')
            if not isinstance(plan['requiredEnvironment'], list) or len(plan['requiredEnvironment']) > 40 or len(set(plan['requiredEnvironment'])) != len(plan['requiredEnvironment']): raise ValueError('Invalid environment declaration')
            if plan.get('storage', 'none') not in ['none','sqlite']: raise ValueError('Invalid storage contract')
            name = prefix + '-health'
            healthy = False
            args = ['docker', 'create', '--name', name, '--user', '10001:10001', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '512m', '--cpus', '1', '--pids-limit', '128', '--log-driver', 'json-file', '--log-opt', 'max-size=4m', '--log-opt', 'max-file=1', '--publish', f'127.0.0.1::{plan["port"]}']
            for destination, options in RUNTIME_TMPFS.items(): args += ['--tmpfs', destination+':'+options]
            for key in plan['requiredEnvironment']:
                if not isinstance(key, str) or not re.fullmatch('[A-Z][A-Z0-9_]{0,79}', key) or key.startswith(('GITHUB_', 'PI_', 'AGENT_', 'BROKER_')): raise ValueError('Invalid environment name')
                value = secrets.token_urlsafe(40); SECRET_VALUES.append(value); TEST_ENVIRONMENT[key] = value; args += ['--env', key+'='+value]
            try:
                step('Create stopped runtime', args + [image_id], 60)
                storage_format = '--format={"mounts":{{json .Mounts}},"tmpfs":{{json .HostConfig.Tmpfs}},"readonly":{{json .HostConfig.ReadonlyRootfs}},"binds":{{json .HostConfig.Binds}},"logs":{{json .HostConfig.LogConfig}}}'
                assert_runtime_storage(load_json(step('Verify stopped runtime storage', ['docker', 'inspect', storage_format, name], 30)))
                step('Start verified runtime', ['docker', 'start', name], 60)
                mapping = step('Inspect runtime port', ['docker', 'port', name, str(plan['port'])+'/tcp'], 30).strip()
                if not re.fullmatch('127[.]0[.]0[.]1:[0-9]+', mapping): raise ValueError('Unexpected runtime port')
                opener = urllib.request.build_opener(NoRedirect)
                for _ in range(45):
                    try:
                        response = opener.open('http://'+mapping+plan['healthPath'], timeout=2)
                        if 200 <= response.status < 400: healthy = True; break
                    except urllib.error.HTTPError as error:
                        if 300 <= error.code < 400: healthy = True; break
                    except (OSError, urllib.error.URLError): pass
                    time.sleep(2)
                else: raise RuntimeError('Runtime did not become healthy')
                probes = policy.get('runtimeProbes', [])
                if not isinstance(probes, list) or len(probes) > 16: raise ValueError('Runtime acceptance profile exceeds limit')
                for index, probe in enumerate(probes):
                    runtime_probe(opener, 'http://'+mapping, probe)
                    outputs.append(f'Pinned runtime acceptance probe {index+1} passed.')
                if plan.get('storage') == 'sqlite':
                    assert_sqlite_runtime(name, policy['nodeImage'])
                    outputs.append('Canonical managed SQLite database file verified.')
            finally:
                if not healthy:
                    _, logs = command(['docker', 'logs', '--tail', '200', name], 20)
                    outputs.append('Runtime diagnostics (synthetic settings only):\n'+logs)
                cleanup_container(name)
            if context_digest(directory) != expected: raise ValueError('Source context changed during checks')
            report['gates']['runtime_health'] = 'passed'
        except Exception as error:
            for gate in GATES:
                if report['gates'][gate] == 'not_run': report['gates'][gate] = 'failed'; break
            outputs.append(clean(str(error))+'\nTrusted runner rejected the candidate or a check failed. No deployment performed.')
        finally:
            cleanup_code, _ = command(['docker', 'buildx', 'rm', '--force', builder], 30)
            if cleanup_code and all(report['gates'][gate] == 'passed' for gate in GATES):
                report['gates']['runtime_health'] = 'failed'
                outputs.append('Build runner cleanup failed; candidate not accepted.')
            report['output'] = clean('\n'.join(outputs))
            REPORT.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
    return 0 if all(report['gates'][gate] == 'passed' for gate in GATES) else 1

def publish():
    if not REPORT.is_file() or REPORT.is_symlink() or REPORT.stat().st_size > 100000: raise ValueError('No bounded runner report to publish')
    report = load_json(REPORT.read_bytes())
    if report['head'] != os.environ['GITHUB_SHA'] or report['runId'] != int(os.environ['GITHUB_RUN_ID']) or report['runAttempt'] != int(os.environ['GITHUB_RUN_ATTEMPT']): raise ValueError('Report identity changed')
    repo = os.environ['GITHUB_REPOSITORY']
    if not re.fullmatch('[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo): raise ValueError('Invalid repository identity')
    payload = {'name': 'Hub isolated preparation proof', 'head_sha': report['head'], 'external_id': f'{report["runId"]}:{report["runAttempt"]}', 'status': 'completed', 'conclusion': 'success' if all(report['gates'][g] == 'passed' for g in GATES) else 'failure', 'details_url': f'https://github.com/{repo}/actions/runs/{report["runId"]}', 'output': {'title': 'Isolated preparation result', 'summary': json.dumps(report, ensure_ascii=False)}}
    request = urllib.request.Request('https://api.github.com/repos/'+repo+'/check-runs', data=json.dumps(payload).encode(), method='POST', headers={'Authorization': 'Bearer '+os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'})
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 201: raise ValueError('Proof publication failed')

if __name__ == '__main__':
    try: sys.exit(publish() if sys.argv[1:] == ['--publish'] else run())
    except Exception:
        print('Trusted preparation runner failed; no verified candidate was accepted.', file=sys.stderr)
        sys.exit(1)
