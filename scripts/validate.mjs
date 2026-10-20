import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import MarkdownIt from 'markdown-it';
import GithubSlugger from 'github-slugger';

const md = new MarkdownIt();
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory()
    ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  return nested.flat().sort();
}
export function frontmatter(source) {
  const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('missing YAML frontmatter');
  const data = YAML.parse(match[1], { uniqueKeys: true });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('frontmatter must be a mapping');
  return { data, body: source.replace(/^\uFEFF/, '').slice(match[0].length) };
}
function tokensDeep(tokens) {
  return tokens.flatMap(t => [t, ...tokensDeep(t.children ?? [])]);
}
function anchors(source) {
  const slugger = new GithubSlugger();
  const tokens = md.parse(source, {});
  const ids = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const inline = tokens[i + 1];
      const label = (inline.children ?? []).filter(t => ['text', 'code_inline'].includes(t.type)).map(t => t.content).join('');
      ids.add(slugger.slug(label));
    }
  }
  return ids;
}
export async function validateSkills(skillsDir) {
  const errors = [];
  const files = await walk(skillsDir);
  const entries = (await readdir(skillsDir, { withFileTypes: true })).filter(e => e.isDirectory());
  if (!entries.length) errors.push('no skills found');
  for (const entry of entries) {
    const file = path.join(skillsDir, entry.name, 'SKILL.md');
    try {
      const { data, body } = frontmatter(await readFile(file, 'utf8'));
      if (typeof data.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name)
          || data.name.length > 64 || data.name !== entry.name) errors.push(`${entry.name}: invalid name or directory mismatch`);
      if (typeof data.description !== 'string' || !data.description.trim()
          || [...data.description].length > 1024) errors.push(`${entry.name}: description must be 1..1024 characters`);
      if (body.trimEnd().split(/\r?\n/).length > 500) errors.push(`${entry.name}: body exceeds 500 lines`);
    } catch (e) { errors.push(`${entry.name}: ${e.message}`); }
  }
  for (const file of files.filter(f => f.endsWith('.md'))) {
    const source = await readFile(file, 'utf8');
    let body = source;
    if (path.basename(file) === 'SKILL.md') {
      try { body = frontmatter(source).body; } catch { continue; }
    }
    const skillRoot = path.join(skillsDir, path.relative(skillsDir, file).split(path.sep)[0]);
    const tokens = tokensDeep(md.parse(body, {}));
    for (const token of tokens) {
      const href = token.type === 'link_open' ? token.attrGet('href')
        : token.type === 'image' ? token.attrGet('src') : null;
      if (!href || /^(?:https?:|mailto:)/i.test(href)) continue;
      try {
        const hashAt = href.indexOf('#');
        const linkPath = hashAt < 0 ? href : href.slice(0, hashAt);
        const fragment = hashAt < 0 ? '' : decodeURIComponent(href.slice(hashAt + 1));
        const target = linkPath ? path.resolve(path.dirname(file), decodeURIComponent(linkPath)) : file;
        const rel = path.relative(skillRoot, target);
        if (path.isAbsolute(linkPath) || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('link escapes portable skill');
        if (!(await stat(target)).isFile()) throw new Error('target is not a file');
        if (fragment && !anchors(await readFile(target, 'utf8')).has(fragment)) throw new Error('missing heading anchor');
      } catch (e) { errors.push(`${path.relative(skillsDir, file)}: broken link ${href} (${e.message})`); }
    }
  }
  return { errors, count: entries.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateSkills(process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'skills'));
  for (const error of result.errors) console.error(error);
  if (result.errors.length) process.exitCode = 1;
  else console.log(`Validated ${result.count} skills: YAML, names, lengths, portable links and anchors OK.`);
}
