import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('catalog_validator',ROOT/'tools/validate_catalog.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class CatalogChecks(unittest.TestCase):
    def setUp(self):
        self.catalog=json.loads((ROOT/'app/src/main/assets/catalog.json').read_text())
        for s in self.catalog['subjects']:
            for r in s['resources']:
                r['source']='https://drive.google.com/file/d/example/view'
                r['downloadUrl']='https://drive.usercontent.google.com/download?id=example'
    def validate(self,j):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'catalog.json';p.write_text(json.dumps(j));return module.validate(p)
    def test_valid_remote_structure(self):self.assertEqual(len(self.validate(self.catalog)['subjects']),3)
    def test_duplicate_id_rejected(self):
        self.catalog['subjects'][1]['id']=self.catalog['subjects'][0]['id']
        with self.assertRaises(AssertionError):self.validate(self.catalog)
    def test_private_file_uri_rejected(self):
        self.catalog['subjects'][0]['resources'][0]['downloadUrl']='file:///data/data/private'
        with self.assertRaises(AssertionError):self.validate(self.catalog)
    def test_unknown_schema_rejected(self):
        self.catalog['schemaVersion']=9
        with self.assertRaises(AssertionError):self.validate(self.catalog)
    def test_bad_checksum_rejected(self):
        self.catalog['subjects'][0]['resources'][0]['sha256']='bad'
        with self.assertRaises(AssertionError):self.validate(self.catalog)
    def test_negative_revision_rejected(self):
        self.catalog['subjects'][0]['resources'][0]['revision']=-1
        with self.assertRaises(AssertionError):self.validate(self.catalog)
    def test_boolean_version_rejected(self):
        self.catalog['version']=True
        with self.assertRaises(AssertionError):self.validate(self.catalog)
    def test_invalid_host_and_redirect_destination(self):
        for source in ['http://drive.google.com/x','https://drive.google.com.evil.com/x','https://evilgoogleusercontent.com/x','https://127.0.0.1/x','https://accounts.google.com/login']:
            self.assertFalse(module.allowed(source))

if __name__=='__main__':unittest.main()
