# find-unused-vue

Lightweight Node script to find *likely* unused `.vue` single-file components in a Vue project.

> Drop `find-unused-vue.js` in your project root and run it to get a machine-friendly JSON report of `.vue` files that aren't referenced by imports, dynamic imports or template tags in your codebase.

---

## Features

* Scans your `src` directory (or another directory you pass) for `.vue` files.
* Parses JS/TS/Vue files for `import` / `import()` statements and literal `.vue` path mentions.
* Scans templates for PascalCase and kebab-case component tags and attempts to match those to `.vue` filenames.
* Resolves path aliases using `tsconfig.json` `compilerOptions.paths` (if present).
* Outputs a compact JSON summary (suitable for CI or further processing) and includes a list of candidate unused files.

---

## Requirements

* Node.js v14 or newer
* `fast-glob` (install as a dev dependency)

### NPM

```bash
npm install --save-dev fast-glob
```

### Yarn

```bash
yarn add --dev fast-glob
```

---

## Installation

You don't need to install globally. Simply add the script to your repository root (for example `scripts/find-unused-vue.js`) and commit it.

Example layout:

```bash
my-vue-project/
├─ src/
├─ tsconfig.json   # optional, used for alias resolution
├─ find-unused-vue.js
└─ package.json
```

---

## Usage

Run from the project root:

```bash
# default scans `src` folder
node find-unused-vue.js > node-candidates.txt

# or specify a different source folder
node find-unused-vue.js app > node-candidates.txt
```

The script will print a JSON object to stdout. Redirect that to a file for later review.

Example output (pretty-printed):

```json
{
  "totalVue": 123,
  "referencedCount": 98,
  "unusedCount": 25,
  "unused": [
    "<absolute-path>/src/components/OldWidget.vue",
    "<absolute-path>/src/views/UnusedView.vue"
  ]
}
```

---

## How it works (brief)

1. Collect all `.vue` files under the specified source directory.
2. Collect all code files (`.js`, `.ts`, `.jsx`, `.tsx`, `.vue`) under the same directory.
3. For each code file:

   * Parse `import` and `import()` literal strings and try to resolve them to `.vue` files.
   * Find literal path occurrences ending with `.vue` and resolve them.
   * Find template tags (PascalCase and kebab-case) and match the tag name to component filenames.
4. Produce a list of `.vue` files that were never marked as referenced.

The script attempts to resolve aliases using `tsconfig.json` `compilerOptions.paths` (if available). It also attempts various filename patterns such as `Component.vue` and `component/index.vue`.

---

## `tsconfig.json` alias support

If your project uses TypeScript-style path aliases (e.g. `@/*` or `@components/*`), the script will try to read `tsconfig.json` (or `jsconfig.json` if you adopt it) and map alias keys to their target paths. The script expects `compilerOptions.baseUrl` and `compilerOptions.paths` shaped like a typical TypeScript config.

Note: Only literal alias patterns are resolved; complex runtime aliasing or custom webpack aliasing outside `tsconfig` will not be resolved unless you mirror the same paths in `tsconfig.json`.

---

## Limitations & known false-positive scenarios

This tool uses static heuristics and therefore can produce false positives. Before deleting anything, always manually inspect and test.

Common cases where a component might be flagged even though it's used:

* **Runtime component registration** — components registered via `Vue.component(...)`, `app.component(...)` or programmatic registration that do not use an import string literal are not detected.
* **Dynamic component names** — using `<component :is="someVar">` with a value built at runtime cannot be matched.
* **Async factories or custom loaders** — if you resolve components through a custom loader or map, static analysis may miss them.
* **Non-standard file resolution** — if your project resolves components with special rules not covered by the script (e.g. custom extensions), detection may fail.
* **Naming mismatches** — template tag name might not match file basename (e.g. `MySuperButton.vue` exporting a different name or using index files in nested folders). The script tries `index.vue` but it’s heuristic.

If you rely heavily on runtime registration or dynamic component naming, this script will be less accurate.

---

## Recommendations / workflow

1. Run the script and inspect the output file (e.g. `node-candidates.txt`).
2. Open each candidate in your editor and search the codebase for references (IDE "Find in Files" or `git grep`).
3. Run your app and test the pages that might use the component.
4. Optionally move the file to a temporary folder (or branch) instead of permanent deletion and run the test suite / manual checks.

---

## Customization

* Modify `SRC` at top of the script or pass the directory as the first CLI argument.
* Update `IGNORE` patterns in the script to exclude extra folders.
* The `toKebab` and tag-matching logic can be extended if you use different naming conventions.

---

## Example: integrate with CI

You might add a job that runs the script and fails or posts the results somewhere. Because static analysis can produce false positives, we recommend **not** auto-deleting files in CI — only highlight candidates for human review.

---

## Troubleshooting

* **No `fast-glob` found** — run `npm install --save-dev fast-glob`.
* **Script doesn't find aliases** — ensure `tsconfig.json` is present and `compilerOptions.paths` is correctly configured.
* **Many false positives** — check for runtime registrations, dynamic components, and custom build-time resolvers.

---

## Contributing

Contributions welcome! Open issues or PRs for:

* Improving alias resolution (webpack/rollup/vue-cli configs)
* Better template parsing (cover `script setup` or `<script setup>`-only components)
* Support for additional heuristics to reduce false positives

Please run linting and include tests where appropriate.

---

## License

This project is provided under the MIT License. See `LICENSE` for details.

---

## Author

Provided as-is. Feel free to use, modify and redistribute.

Happy cleaning! 🧹
