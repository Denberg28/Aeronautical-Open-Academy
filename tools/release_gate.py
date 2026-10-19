#!/usr/bin/env python3
"""Conservative candidate gate. No stable or reused versions are accepted here."""
import os
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
version=re.search(r"versionName '([^']+)'",(root/'app/build.gradle').read_text()).group(1)
tag=os.environ.get('RELEASE_TAG','')
assert tag=='v'+version,'Candidate tag must match the application version'
assert re.fullmatch(r'v\d+\.\d+\.\d+-(alpha|beta|rc)\.\d+',tag),'Only prereleases are authorized by this workflow'
issues=(root/'docs/KNOWN_ISSUES.md').read_text()
assert not re.search(r'^\|\s*(CRITICAL|HIGH)\s*\|',issues,re.M),'Critical/high defect blocks candidate delivery'
print('PASS: candidate version and defect gate; device/Drive validation still required')
