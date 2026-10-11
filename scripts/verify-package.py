import hashlib
import json
import os
import zipfile
from pathlib import Path

package = Path('dist/cosmos-observatory-next.zip')
with zipfile.ZipFile(package) as archive:
    assert archive.testzip() is None, 'ZIP CRC failure'
    entries = archive.namelist()
    assert len(entries) == len(set(entries)), 'Duplicate ZIP entry'
    assert all(not entry.startswith('/') and '..' not in entry.split('/') for entry in entries)
    sums = dict(line.split('  ', 1)[::-1] for line in archive.read('FILE-SHA256SUMS').decode().splitlines())
    actual = {entry for entry in entries if not entry.endswith('/') and entry != 'FILE-SHA256SUMS'}
    assert set(sums) == actual, 'Every packaged file requires a checksum'
    for entry, expected in sums.items():
        assert hashlib.sha256(archive.read(entry)).hexdigest() == expected, entry
    build = json.loads(archive.read('BUILD-INFO.json'))
    candidate = json.loads(archive.read('CANDIDATE-VERIFICATION.json'))
    assert build['commit'] == candidate['commit'] == os.environ['GITHUB_SHA']
    assert build['run'] == candidate['run']
    assert candidate['verificationGate'] == 'passed'
    assert 'software-rendering' in candidate['required']
    assert 'captured panel pixels' in candidate['required']
    panels = json.loads(archive.read('PANEL-VERIFICATION.json'))
    assert panels['commit'] == build['commit'] and panels['run'] == build['run']
    assert len(panels['browser']) == 2 and len(panels['native']) == 4
    performance = json.loads(archive.read('PERFORMANCE-VERIFICATION.json'))
    assert performance['provenance']['commit'] == build['commit']
    assert performance['provenance']['run'] == os.environ['GITHUB_RUN_ID']
    assert 'llvmpipe' in performance['normal']['start']['driver']
    assert performance['normal']['fps'] >= 15 and performance['stress']['fps'] >= 10
    assert performance['interaction']['p95'] <= 200
print(f'Verified {len(sums)} packaged files against the immutable source and complete gate')
