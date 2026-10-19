#!/usr/bin/env python3
"""Source/content packaging checks. These do not claim an Android build."""
import hashlib
import re
from pathlib import Path
import xml.etree.ElementTree as ET
from validate_catalog import validate

ROOT=Path(__file__).resolve().parents[1]
validate(ROOT/'app/src/main/assets/catalog.json',True)
for p in ROOT.glob('app/src/main/**/*.xml'):ET.parse(p)
expected='2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046'
assert hashlib.sha256((ROOT/'gradle/wrapper/gradle-wrapper.jar').read_bytes()).hexdigest()==expected,'Wrapper checksum mismatch'
props=(ROOT/'gradle/wrapper/gradle-wrapper.properties').read_text()
assert 'distributionSha256Sum=f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6' in props
android='{http://schemas.android.com/apk/res/android}'
manifest=ET.parse(ROOT/'app/src/main/AndroidManifest.xml').getroot()
app=manifest.find('application')
assert app.get(android+'usesCleartextTraffic')=='false'
assert app.get(android+'allowBackup')=='false'
for p in ROOT.rglob('*'):
    if not p.is_file() or any(x in p.parts for x in ['.git','out','build','.gradle','output','__pycache__']):continue
    assert p.suffix.lower() not in ['.jks','.keystore','.p12'],f'Signing material must not be packaged: {p}'
    if p.suffix in ['.java','.json','.xml','.gradle','.yml','.properties']:
        text=p.read_text()
        assert not re.search(r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',text),f'Private key found: {p}'
        assert not re.search(r'(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})',text),f'GitHub token found: {p}'
print('PASS: catalog/assets, XML, Gradle wrapper integrity, network configuration, and focused secret scan')
