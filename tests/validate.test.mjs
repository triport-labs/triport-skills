import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateSkills } from '../scripts/validate.mjs';

async function fixture(t, text, reference = '') {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'triport-skill-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'valid-skill', 'reference'), { recursive: true });
  await writeFile(path.join(dir, 'valid-skill', 'SKILL.md'), text);
  await writeFile(path.join(dir, 'valid-skill', 'reference', 'guide.md'), reference);
  return dir;
}
const header = '---\nname: valid-skill\ndescription: "Use for a concrete Triport request."\n---\n';
test('valid YAML, reference links, duplicate heading anchors and code samples', async t => {
  const dir = await fixture(t, header + '[Guide][g]\n\n[g]: reference/guide.md#hello-1\n\n```ts\n// [ignored](missing.md)\n```', '# Hello\n# Hello\n');
  assert.deepEqual((await validateSkills(dir)).errors, []);
});
test('missing targets, fragments and portable containment fail', async t => {
  const dir = await fixture(t, header + '[missing](reference/missing.md)\n[anchor](reference/guide.md#absent)\n[escape](../outside.md)');
  const { errors } = await validateSkills(dir);
  assert.equal(errors.length, 3);
});
test('invalid YAML and duplicate mapping keys fail', async t => {
  const dir = await fixture(t, '---\nname: valid-skill\nname: other\ndescription: ok\n---\n');
  assert.match((await validateSkills(dir)).errors.join('\n'), /unique|duplicate/i);
});
test('description and body limits fail', async t => {
  const dir = await fixture(t, `---\nname: valid-skill\ndescription: "${'a'.repeat(1025)}"\n---\n${'line\n'.repeat(501)}`);
  assert.equal((await validateSkills(dir)).errors.length, 2);
});
test('empty discovery and name mismatch fail', async t => {
  const dir = await fixture(t, header.replace('name: valid-skill', 'name: Wrong_Name'));
  assert.match((await validateSkills(dir)).errors.join('\n'), /invalid name/);
  const empty = path.join(dir, 'empty');
  await mkdir(empty);
  assert.match((await validateSkills(empty)).errors.join('\n'), /no skills/);
});
