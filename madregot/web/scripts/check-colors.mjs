#!/usr/bin/env node
// Colour lint (STUDENT-2): every colour on screen comes from a token, so the dark theme stays a swap of token values.
// A hex or rgb()/rgba() literal fails in src/styles/*.css (except tokens.css, where the tokens are defined, and
// dark.css, where their dark values will be) and in src/**/*.jsx, unless its line says why it stays: "colour-ok: <reason>".
// CSS comments are not checked. Run: npm run lint:colors (styles.test.js runs it with the unit tests too).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(here, '../src');
export const EXEMPT = new Set(['tokens.css', 'dark.css']);
// "&#123;" is an HTML entity, not a colour
const LITERAL = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\(/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.jsx')) out.push(p);
  }
  return out;
}

/** The files the lint reads. */
export function colourFiles(src = SRC) {
  const styles = path.join(src, 'styles');
  const css = fs.readdirSync(styles).filter((f) => f.endsWith('.css') && !EXEMPT.has(f)).map((f) => path.join(styles, f));
  return [...css, ...walk(src)];
}

// blank out /* comments */ in CSS, keeping the line breaks so line numbers stay true
const blankComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

/** Every literal colour without a colour-ok reason on its line: [{ file, line, text }]. */
export function findColourLiterals(files = colourFiles(), root = SRC) {
  const bad = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const code = file.endsWith('.css') ? blankComments(raw) : raw;
    const rawLines = raw.split('\n');
    code.split('\n').forEach((l, i) => {
      if (LITERAL.test(l) && !rawLines[i].includes('colour-ok:')) bad.push({ file: path.relative(root, file), line: i + 1, text: rawLines[i].trim().slice(0, 160) });
    });
  }
  return bad;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = findColourLiterals();
  if (bad.length) {
    for (const b of bad) console.error(`${b.file}:${b.line}  ${b.text}`);
    console.error(`\n${bad.length} colour literal(s) outside tokens.css. Use a token (tokens.css), or add "colour-ok: <reason>" on the line if the colour must stay.`);
    process.exit(1);
  }
  console.log(`colours: every literal is a token or marked colour-ok (${colourFiles().length} files)`);
}
