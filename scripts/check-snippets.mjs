import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import MarkdownIt from 'markdown-it';
import { walk, root } from './validate.mjs';

const require = createRequire(import.meta.url);
const md = new MarkdownIt();
const temp = await mkdtemp(path.join(root, '.snippet-check-'));
let tsCount = 0, pyCount = 0;
const perSkill = new Map();
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} failed\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`);
}
try {
  for (const file of (await walk(path.join(root, 'skills'))).filter(f => f.endsWith('.md'))) {
    const tokens = md.parse(await readFile(file, 'utf8'), {});
    let index = 0;
    for (const token of tokens.filter(t => t.type === 'fence')) {
      const lang = token.info.trim().split(/\s+/)[0];
      if (['js', 'javascript', 'tsx', 'py'].includes(lang)) throw new Error(`${file}: use checked ts or python fences`);
      if (!['ts', 'typescript', 'python'].includes(lang)) continue;
      const isPy = lang === 'python';
      const skill = path.relative(path.join(root, 'skills'), file).split(path.sep)[0];
      const coverage = perSkill.get(skill) ?? new Set();
      coverage.add(isPy ? 'python' : 'ts');
      perSkill.set(skill, coverage);
      const name = `${path.relative(path.join(root, 'skills'), file).replace(/[^\w-]/g, '_')}-${index++}.${isPy ? 'py' : 'ts'}`;
      const target = path.join(temp, name);
      await writeFile(target, token.content);
      if (isPy) {
        run(process.env.PYTHON ?? 'python', ['-m', 'py_compile', target]);
        pyCount++;
      } else tsCount++;
    }
  }
  await writeFile(path.join(temp, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, types: ['node'] },
    include: ['*.ts']
  }));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', path.join(temp, 'tsconfig.json')]);
  if (tsCount < 7 || pyCount < 7) throw new Error('Each of seven skills needs TypeScript and Python examples');
  for (const [skill, languages] of perSkill) {
    if (languages.size !== 2) throw new Error(`${skill}: missing TypeScript or Python examples`);
  }
  if (perSkill.size !== 7) throw new Error('Expected examples in all seven skills');
  console.log(`Checked ${tsCount} TypeScript snippets (tsc --noEmit) and ${pyCount} Python snippets (py_compile).`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
