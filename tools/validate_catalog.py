#!/usr/bin/env python3
"""Validate the instructor catalog before publishing it. Standard library only."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ID = re.compile(r"[a-z0-9][a-z0-9-]{0,47}")
def allowed(raw):
    try:
        u=urlsplit(raw)
        return (len(raw)<=2048 and u.scheme=='https' and not u.username and not u.password
                and u.port in (None,443) and (u.hostname in ('drive.google.com','docs.google.com','drive.usercontent.google.com')
                or (u.hostname or '').endswith('.googleusercontent.com')))
    except ValueError:
        return False

def validate(path, bundled=False):
    raw=path.read_bytes()
    assert len(raw)<=1024*1024,'Catalog exceeds 1 MB'
    j=json.loads(raw)
    assert type(j['schemaVersion']) is int and j['schemaVersion']==1,'Unsupported schema'
    assert type(j['version']) is int and j['version']>=1,'Invalid catalog version'
    assert isinstance(j['title'],str) and 1<=len(j['title'].strip())<=160,'Invalid catalog title'
    assert 1<=len(j['subjects'])<=100,'Subject count out of bounds'
    ids=set()
    def identifier(value):
        assert isinstance(value,str) and ID.fullmatch(value) and value not in ids,'Invalid/duplicate ID: '+str(value)
        ids.add(value)
    def text(obj,key,maximum):
        assert isinstance(obj[key],str) and 1<=len(obj[key].strip())<=maximum,'Invalid '+key
    def source(value):
        assert isinstance(value,str),'Source must be a string'
        if bundled and re.fullmatch(r'asset://materials/[a-z0-9-]+\.pdf',value):
            p=path.parent/value[8:]
            assert p.is_file(),'Missing bundled PDF: '+str(p)
            return p
        assert allowed(value),'Unapproved source: '+value
    for s in j['subjects']:
        identifier(s['id'])
        for key,maximum in [('code',32),('title',160),('description',600)]:text(s,key,maximum)
        assert len(s['resources'])<=200,'Too many resources'
        for r in s['resources']:
            identifier(r['id'])
            for key,maximum in [('title',160),('module',120),('description',1000),('license',240)]:text(r,key,maximum)
            assert type(r['revision']) is int and 1<=r['revision']<=2147483647,'Invalid resource revision'
            assert re.fullmatch(r'[a-fA-F0-9]{64}',r.get('sha256','')) or r.get('sha256','')=='','Invalid SHA-256'
            assert isinstance(r.get('text',''),str) and len(r.get('text',''))<=12000,'Text companion exceeds 12000 characters'
            source(r['source'])
            if r.get('downloadable',False):
                assert r['mimeType']=='application/pdf','Offline format must be PDF'
                p=source(r['downloadUrl'])
                if p and r.get('sha256'):assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],'PDF checksum mismatch'
    return j

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('catalog',type=Path);p.add_argument('--bundled',action='store_true');a=p.parse_args()
    try:
        j=validate(a.catalog,a.bundled)
        print(f"PASS: catalog version {j['version']}, {len(j['subjects'])} subjects")
    except (AssertionError,ValueError,KeyError,TypeError,OSError) as e:
        p.exit(1,f'FAIL: {e}\n')
