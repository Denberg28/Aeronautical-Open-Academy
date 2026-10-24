import test from "node:test";
import assert from "node:assert/strict";
import { describeLink, materialPresentation } from "../materials.mjs";
import { linksInText } from "../../server/src/links.mjs";

const fixtures = [
  ["https://drive.google.com/file/d/synthetic/view?usp=sharing&resourcekey=0-demo#page=2", "Google Drive"],
  ["https://docs.google.com/document/d/synthetic/edit?usp=sharing", "Google Docs"],
  ["https://docs.google.com/spreadsheets/d/synthetic/edit#gid=14", "Google Sheets"],
  ["https://docs.google.com/presentation/d/synthetic/edit#slide=id.demo", "Google Slides"],
  ["https://youtu.be/synthetic?t=30", "YouTube"],
  ["https://www.youtube.com/playlist?list=synthetic", "YouTube"],
  ["https://images.nasa.gov/synthetic.jpg?download=1", "Image"],
  ["https://www.nasa.gov/synthetic.PDF", "PDF"],
  ["https://docs.google.com.evil.com/document/d/synthetic", "Website"],
];
test("material presentation preserves sharing keys, fragments and canonical backend references", () => {
  for (const [url, label] of fixtures) {
    assert.deepEqual(describeLink(url), { url, label, host: new URL(url).hostname });
    const item = { title: "Lesson", body: `Lesson\nReference (${url}).\n${url}` };
    const result = materialPresentation(item);
    assert.deepEqual(result.links.map((link) => link.url), linksInText(item.body));
    assert.equal(result.links.length, 1);
    assert.equal(result.text, "Reference ().");
  }
  const only = materialPresentation({title: fixtures[0][0], body: fixtures[0][0]});
  assert.equal(only.links.length, 1);
  const balanced = "https://www.nasa.gov/reference_(flight)";
  assert.deepEqual(materialPresentation({ title: "", body: balanced + ")." }).links.map((l) => l.url), [balanced]);
});
test("unsafe references remain text and cannot become external links", () => {
  for (const raw of ["file:///etc/passwd", "javascript:alert(1)", "https://user:pass@www.nasa.gov/", "http://127.0.0.1/", "https://school.local/", "https://www.nasa.gov:8443/", "https://www.nasa.gov/\\bad"]) {
    assert.throws(() => describeLink(raw));
    assert.equal(materialPresentation({title: "", body: raw}).links.length, 0);
  }
});
