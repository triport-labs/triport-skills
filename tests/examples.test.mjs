import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import MarkdownIt from 'markdown-it';
import { root } from '../scripts/validate.mjs';

async function runLogExample(mode) {
  const source = await readFile(path.join(root, 'skills/triport-evm-rpc/SKILL.md'), 'utf8');
  const fence = new MarkdownIt().parse(source, {}).find(t => t.type === 'fence' && t.info === 'ts');
  const compiled = ts.transpileModule(fence.content, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const harness = `
    process.env.TRIPORT_API_KEY = 'offline-fixture';
    process.env.EVM_CONTRACT = '0x' + '1'.repeat(40);
    process.env.EVM_CHAIN = 'base';
    process.env.LOG_CHUNK = '3';
    const calls = [];
    globalThis.fetch = async (url, init) => {
      if (url !== 'https://triport.io/rpc/base') throw new Error('wrong route');
      const body = JSON.parse(init.body);
      if (body.method === 'eth_blockNumber') return new Response(JSON.stringify({result:'0xa'}));
      const filter = body.params[0];
      const from = Number(BigInt(filter.fromBlock)), to = Number(BigInt(filter.toBlock));
      calls.push([from, to]);
      if (${JSON.stringify(mode)} === 'auth') return new Response('{}', {status:401});
      if (${JSON.stringify(mode)} === 'archive') return new Response(JSON.stringify({error:{code:-32005,message:'history pruned'}}));
      if (to > from) return new Response(JSON.stringify({error:{code:-32005,message:'block range too wide'}}));
      return new Response(JSON.stringify({result:[{blockNumber:filter.fromBlock}]}));
    };
    try { await import('data:text/javascript;base64,' + ${JSON.stringify(Buffer.from(compiled).toString('base64'))}); }
    catch (e) { console.log('STOP', e.message); }
    console.log('CALLS', JSON.stringify(calls));
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', harness], { encoding: 'utf8', windowsHide: true });
}
test('documented EVM scanner shrinks range errors and covers inclusive bounds once', async () => {
  const result = await runLogExample('range');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CALLS \[\[8,10\],\[8,8\],\[9,9\],\[10,10\]\]/);
  assert.doesNotMatch(result.stdout, /STOP/);
});
test('documented scanner stops on auth and archive failures without silently skipping', async () => {
  for (const mode of ['auth', 'archive']) {
    const result = await runLogExample(mode);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /STOP/);
    assert.match(result.stdout, /CALLS \[\[8,10\]\]/);
  }
});
