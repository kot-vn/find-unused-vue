/* eslint-disable */
// find-unused-vue.js
// Usage: node find-unused-vue.js [srcDir]

const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');

const ROOT = process.cwd();
const SRC = process.argv[2] || 'src';
const IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/coverage/**'];

function toKebab(name) {
  return name
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

function readTsconfigPaths() {
  const cfgPath = path.join(ROOT, 'tsconfig.json');
  if (!fs.existsSync(cfgPath)) return null;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const baseUrl = (cfg.compilerOptions && cfg.compilerOptions.baseUrl) || '.';
    const paths = (cfg.compilerOptions && cfg.compilerOptions.paths) || {};
    const map = [];
    for (const key of Object.keys(paths)) {
      // key like "@/*" or "@components/*"
      const cleanKey = key.replace(/\*$/, '');
      const targets = paths[key].map(t => t.replace(/\*$/, ''));
      map.push({ key: cleanKey, targets, baseUrl });
    }
    return map;
  } catch (e) {
    return null;
  }
}

function resolveImport(fromFile, importPath, aliases) {
  if (importPath.startsWith('.')) {
    const abs = path.resolve(path.dirname(fromFile), importPath);
    return tryWithVueExt(abs);
  }
  // alias resolution using tsconfig paths if available
  if (aliases) {
    for (const a of aliases) {
      if (importPath.startsWith(a.key)) {
        const rest = importPath.slice(a.key.length); // may start with '/'
        for (const t of a.targets) {
          const candidate = path.resolve(ROOT, a.baseUrl, t, rest);
          const r = tryWithVueExt(candidate);
          if (r) return r;
        }
      }
    }
  }
  // not relative and not matched -> skip (could be package import)
  return null;
}

function tryWithVueExt(p) {
  const exts = ['', '.vue', '/index.vue'];
  for (const e of exts) {
    const full = p + e;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return path.resolve(full);
  }
  return null;
}

(async function main() {
  const aliases = readTsconfigPaths();

  const vueFiles = await fg([`${SRC}/**/*.vue`], { absolute: true, ignore: IGNORE });
  const codeFiles = await fg([`${SRC}/**/*.{js,ts,jsx,tsx,vue}`], { absolute: true, ignore: IGNORE });

  const allVueSet = new Set(vueFiles.map(p => path.resolve(p)));
  const referenced = new Map(); // path -> Set of reasons

  function markReferenced(p, reason) {
    if (!p) return;
    p = path.resolve(p);
    if (!allVueSet.has(p)) return;
    if (!referenced.has(p)) referenced.set(p, new Set());
    referenced.get(p).add(reason);
  }

  // 1) scan imports and dynamic imports
  const importFromRegex = /from\s+["'`]([^"'`]+)["'`]/g;
  const dynamicImportRegex = /import\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

  for (const file of codeFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // literal .vue or paths that might resolve to .vue
    let m;
    while ((m = importFromRegex.exec(content)) !== null) {
      const p = m[1];
      const resolved = resolveImport(file, p, aliases);
      if (resolved) markReferenced(resolved, `import from ${path.relative(ROOT, file)} -> ${p}`);
    }
    while ((m = dynamicImportRegex.exec(content)) !== null) {
      const p = m[1];
      const resolved = resolveImport(file, p, aliases);
      if (resolved) markReferenced(resolved, `dynamic import in ${path.relative(ROOT, file)} -> ${p}`);
    }

    // also find explicit .vue occurrences anywhere
    const pathLit = /([./A-Za-z0-9@_\-\/]+\.vue)/g;
    while ((m = pathLit.exec(content)) !== null) {
      const p = m[1];
      // resolve relative or alias
      const resolved = resolveImport(file, p, aliases) || tryWithVueExt(path.resolve(path.dirname(file), p));
      if (resolved) markReferenced(resolved, `literal .vue mention in ${path.relative(ROOT, file)}`);
    }

    // 2) template tags within .vue files or other files:
    // PascalCase tags
    const pascalTag = /<([A-Z][A-Za-z0-9]+)(\s|\/|>)/g;
    while ((m = pascalTag.exec(content)) !== null) {
      const tag = m[1];
      // find candidate file by basename
      for (const vf of vueFiles) {
        if (path.basename(vf, '.vue') === tag) markReferenced(vf, `tag <${tag}> in ${path.relative(ROOT, file)}`);
      }
    }
    // kebab-case tags
    const kebabTag = /<([a-z][a-z0-9\-]+)(\s|\/|>)/g;
    while ((m = kebabTag.exec(content)) !== null) {
      const tag = m[1];
      for (const vf of vueFiles) {
        const base = path.basename(vf, '.vue');
        if (toKebab(base) === tag) markReferenced(vf, `kebab tag <${tag}> in ${path.relative(ROOT, file)}`);
      }
    }
  }

  // compute unused list
  const unused = [];
  for (const v of vueFiles) {
    if (!referenced.has(path.resolve(v))) {
      unused.push(v);
    }
  }

  // output: JSON lines for easier machine parsing, but also print summary to stdout
  const out = {
    totalVue: vueFiles.length,
    referencedCount: referenced.size,
    unusedCount: unused.length,
    unused
  };
  console.log(JSON.stringify(out, null, 2));
})();
