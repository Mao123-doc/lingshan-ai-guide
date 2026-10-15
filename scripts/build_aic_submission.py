"""Create a sanitized AIC source submission without changing source files.

Uses only Python's standard library. Runtime dependencies and credentials are
excluded; the restored visitor/admin modules and required local assets are included.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'submission' / 'current'
PACKAGE = 'AIC_场景创新_项目工程文件'
ZIP_PATH = OUTPUT / 'AIC_场景创新_参赛工程文件.zip'
BLOCKED = {'node_modules', 'dist', 'build', '__pycache__', '.git', '.venv', 'playwright-report', 'test-results'}
LEGACY = set()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def prepare():
    files = set()
    for directory in ['backend/src', 'backend/tests', 'backend/python', 'frontend/src', 'frontend/tests', 'frontend/e2e', 'data/route', 'evaluation/retrieval', 'evaluation/scene', 'evaluation/route', 'evaluation/manifests']:
        for path in (ROOT / directory).rglob('*'):
            if path.is_file() and not any(part in BLOCKED for part in path.relative_to(ROOT).parts):
                files.add(path.relative_to(ROOT).as_posix())
    for module in ['frontend', 'backend']:
        files.update(path.relative_to(ROOT).as_posix() for path in (ROOT / module).iterdir() if path.is_file())
    for run in ['baseline_20260917_020000', 'ablation_20260917_013925', 'scene', 'route']:
        files.update(path.relative_to(ROOT).as_posix() for path in (ROOT / 'evaluation/results' / run).rglob('*') if path.is_file())
    recommendation = (ROOT / 'frontend/src/pages/visitor/RecommendPage.tsx').read_text(encoding='utf-8')
    images = set(re.findall(r"['\"]([a-z_]+\.jpg)['\"]", recommendation))
    for filename in images:
        path = ROOT / 'frontend/public' / filename
        if not path.is_file():
            raise RuntimeError(f'Missing referenced image: {filename}')
        files.add(path.relative_to(ROOT).as_posix())
    files.update(path.relative_to(ROOT).as_posix() for path in (ROOT / 'frontend/public').rglob('*') if path.is_file())
    files.update(['AGENTS.md', 'docs/core-version.md', 'docs/competition/feature-contract.md', 'docs/testing/competition-alignment-20261015.md'])
    files.update(['package.json', 'package-lock.json', 'LICENSE', 'data/raw/knowledge_guide.txt', 'data/raw/knowledge_dataset.txt', 'docs/ablation_report.md', 'docs/knowledge-corpus.md', 'docs/testing/runtime-smoke.md', 'docs/third-party-resources.md', 'scripts/start.bat', 'scripts/stop.bat', 'scripts/run_ablation.py', 'scripts/verify-release.ps1', 'scripts/build_aic_submission.py', 'scripts/verify-competition-runtime.cjs'])
    files = {name for name in files if name not in LEGACY and Path(name).suffix not in {'.zip', '.pyc', '.log', '.tsbuildinfo'} and not Path(name).name.startswith('.env')}
    content = {name: (ROOT / name).read_bytes() for name in sorted(files)}
    content['.env.example'] = b'DEEPSEEK_API_KEY=\nDEEPSEEK_MODEL=deepseek-chat\nAGNES_API_KEY=\nAGNES_MODEL=agnes-2.0-flash\nAGNES_BASE_URL=https://apihub.agnes-ai.com/v1\nSECRET_KEY=\nADMIN_USERNAME=admin\nADMIN_PASSWORD=\nPORT=8010\nVECTOR_SERVICE_URL=http://127.0.0.1:8002\nVISION_BASE_URL=\nVISION_MODEL=\nVISION_API_KEY=\nCORS_ORIGINS=http://localhost:5173,http://localhost:8010\n'
    content['README.md'] = (ROOT / 'README.md').read_bytes()
    return content


def scan(content):
    secrets = []
    for path in ROOT.glob('.env*'):
        if path.name == '.env.example':
            continue
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                value = value.strip().strip('\"\'')
                if re.search(r'KEY|TOKEN|PASSWORD|SECRET|COOKIE', key, re.I) and len(value) >= 8:
                    secrets.append(value.encode())
    token_pattern = rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
    for name, data in content.items():
        if any(secret in data for secret in secrets) or re.search(token_pattern, data):
            raise RuntimeError(f'Sensitive content: {name}; value withheld')





def main():
    OUTPUT.mkdir(exist_ok=True, parents=True)
    content = prepare()
    scan(content)
    try:
        git_head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
        git_dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip())
    except (OSError, subprocess.CalledProcessError):
        git_head, git_dirty = None, None
    references = [path for name in ['lingxiaochan10-06.pptx', '项目方案2.0.pdf'] for path in (ROOT / '竞赛汇报与文档材料包').rglob(name)]
    manifest = {'schema_version': 2, 'git_head': git_head, 'tracked_worktree_dirty': git_dirty, 'reference_materials': [{'path': str(path.relative_to(ROOT)), 'sha256': digest(path.read_bytes())} for path in references], 'files': [{'path': name, 'size': len(data), 'sha256': digest(data)} for name, data in sorted(content.items())], 'excluded_legacy': sorted(LEGACY), 'sensitive_scan': 'No actual local env secret or known token/private-key signature found; binary visual/privacy checks remain manual.'}
    content['SUBMISSION_MANIFEST.json'] = json.dumps(manifest, ensure_ascii=False, indent=2).encode('utf-8')
    with tempfile.TemporaryDirectory(prefix='_aic_pack_', dir=OUTPUT) as temporary:
        candidate = Path(temporary) / 'candidate.zip'
        with zipfile.ZipFile(candidate, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, data in sorted(content.items()):
                archive.writestr(PACKAGE + '/' + name, data)
        with zipfile.ZipFile(candidate) as archive:
            assert archive.testzip() is None
            assert len(archive.namelist()) == len(set(n.casefold() for n in archive.namelist()))
            for item in manifest['files']:
                assert digest(archive.read(PACKAGE + '/' + item['path'])) == item['sha256']
        candidate.replace(ZIP_PATH)
    checksum = digest(ZIP_PATH.read_bytes())
    (OUTPUT / 'SHA256SUMS.txt').write_text(f'{checksum}  {ZIP_PATH.name}\n', encoding='utf-8')
    print(json.dumps({'zip': str(ZIP_PATH), 'bytes': ZIP_PATH.stat().st_size, 'files': len(content), 'sha256': checksum}, ensure_ascii=False))


if __name__ == '__main__':
    main()
