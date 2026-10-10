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
print(f'Verified {len(sums)} packaged files against the immutable source and complete gate')
