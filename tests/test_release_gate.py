"""Exercise the actual publication gate in an isolated miniature repository."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class ReleaseGateChecks(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        for name in ['tools','app','docs']:(self.root/name).mkdir()
        shutil.copyfile(ROOT/'tools/release_gate.py',self.root/'tools/release_gate.py')
        (self.root/'app/build.gradle').write_text("versionName '0.4.0-alpha.1'\n")
        self.issues=self.root/'docs/KNOWN_ISSUES.md'
        self.issues.write_text('| LIMITATION | Device validation pending |\n')
    def tearDown(self):
        self.temp.cleanup()
    def run_gate(self,args=(),tag=''):
        return subprocess.run(['python3',str(self.root/'tools/release_gate.py'),*args],env={**os.environ,'RELEASE_TAG':tag},capture_output=True,text=True).returncode
    def test_test_build_passes_normal_limits_but_rejects_known_critical_and_high(self):
        self.assertEqual(self.run_gate(['--test-build']),0)
        for severity in ['CRITICAL','HIGH']:
            with self.subTest(severity=severity):
                self.issues.write_text('| '+severity+' | Reproduced defect |\n')
                self.assertNotEqual(self.run_gate(['--test-build']),0)
    def test_signed_candidate_requires_exact_unique_prerelease_shape(self):
        self.assertEqual(self.run_gate(tag='v0.4.0-alpha.1'),0)
        for tag in ['', 'v0.3.0-alpha.1','v0.4.0']:
            with self.subTest(tag=tag):
                self.assertNotEqual(self.run_gate(tag=tag),0)
        (self.root/'app/build.gradle').write_text("versionName '0.4.0'\n")
        self.assertNotEqual(self.run_gate(tag='v0.4.0'),0)
