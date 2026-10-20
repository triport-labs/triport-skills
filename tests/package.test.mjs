import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { root, frontmatter } from '../scripts/validate.mjs';

const expected = ['triport-evm-rpc', 'triport-getting-started', 'triport-other-chains',
  'triport-solana-rpc', 'triport-solana-shreds', 'triport-wallet-apis', 'triport-yellowstone-grpc'];
const json = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
test('standalone repository and marketplace discover the seven portable skills', async () => {
  const repo = await json('REPO.json');
  const plugin = await json('.claude-plugin/plugin.json');
  const marketplace = await json('.claude-plugin/marketplace.json');
  assert.equal(repo.name, 'triport-skills');
  assert.ok(repo.description.length <= 300);
  assert.ok(repo.topics.length <= 12);
  assert.ok(repo.topics.every(topic => /^[a-z0-9-]+$/.test(topic)));
  assert.equal(marketplace.plugins[0].name, plugin.name);
  assert.equal(marketplace.plugins[0].source, './');
  assert.ok(marketplace.owner.name);
  assert.deepEqual((await readdir(path.join(root, 'skills'))).sort(), expected);
  for (const name of expected) {
    const source = await readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    assert.equal(frontmatter(source).data.name, name);
  }
  for (const file of ['README.md', 'LICENSE', '.gitignore', 'CONTRIBUTING.md', 'SECURITY.md', '.github/workflows/ci.yml']) {
    assert.ok((await stat(path.join(root, file))).isFile());
  }
});
test('Codex and Cursor routers point at existing skill entrypoints', async () => {
  for (const name of expected) {
    for (const file of ['integrations/AGENTS.md', 'integrations/triport.mdc']) {
      const source = await readFile(path.join(root, file), 'utf8');
      assert.ok(source.includes(`${name}/SKILL.md`), `${file} missing ${name}`);
    }
  }
});
