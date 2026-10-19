import test from 'node:test';
import assert from 'node:assert/strict';
import { externalUrl,linksInText,linkFromText } from '../src/links.mjs';

test('web references allow public HTTP/HTTPS services while blocking unsafe schemes, credentials and local destinations',()=>{
 for(const value of ['https://docs.google.com/document/d/demo/edit?usp=sharing','https://docs.google.com/presentation/d/demo/edit#slide=id.1','https://docs.google.com/spreadsheets/d/demo/edit','https://drive.google.com/file/d/demo/view','https://youtu.be/demo?t=20','http://www.example.org/lesson','https://www.example.org/guide.pdf','https://www.example.org/grades.xlsx','https://www.example.org/wiki/Topic_(detail)','https://www.example.org:443/a','http://www.example.org:80/a'])assert.ok(externalUrl(value));
 for(const value of ['javascript:alert(1)','file:///a','content://private/a','intent://host','https://user:pass@example.org/a','https://127.0.0.1/a','http://10.0.0.1/a','http://2130706433/a','http://0x7f000001/a','https://[::1]/a','http://localhost/a','https://school.local/a','https://a.internal/a','https://www.example.org:8443/a','https://www.example.org/a\\evil','https://www.example.org/a\nb'])assert.throws(()=>externalUrl(value));
 assert.throws(()=>externalUrl('https://www.example.org/'+'a'.repeat(2048)));
});

test('inline extraction preserves balanced URL punctuation and exact-reference checks reject replaced or injected URLs',()=>{
 const text='Slides (https://docs.google.com/presentation/d/demo/edit). Video https://youtu.be/demo?t=4 and https://www.example.org/wiki/Topic_(detail).';
 assert.deepEqual(linksInText(text),['https://docs.google.com/presentation/d/demo/edit','https://youtu.be/demo?t=4','https://www.example.org/wiki/Topic_(detail)']);
 assert.equal(linkFromText('https://youtu.be/demo?t=4',text),'https://youtu.be/demo?t=4');
 assert.throws(()=>linkFromText('https://youtu.be/demo?t=5',text));assert.throws(()=>linkFromText('https://www.example.org/injected',text));
 assert.deepEqual(linksInText('unsafe https://127.0.0.1/private and javascript:alert(1)'),[]);
});
