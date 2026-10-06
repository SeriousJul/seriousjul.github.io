# Vendor copy of braces 3.0.4 (3.0.3 plus depth guards)

This directory is a vendored copy of the npm package `braces`, kept in the
repository because the registry has no patched version.

## Why it is vendored

CVE-2026-93687 (GHSA-vfj7-8cjw-p6xm, high, CVSS 7.5): the recursive AST
walkers in braces lack depth guards. A pattern whose nesting depth is large
while its length stays under `MAX_LENGTH` (10000 characters) exhausts the
V8 call stack and kills the Node.js process with an uncaught
`RangeError: Maximum call stack size exceeded`. Measured on Node 20, a
4999-deep parenthesized pattern (9999 characters, under the limit) crashes
`braces.compile` and `braces.stringify`.

As of 2026-10-06 the latest published version is 3.0.3, the last version in
the vulnerable range `<= 3.0.3`, and upstream issue micromatch/braces#70 is
still open. `first_patched_version` in the advisory is `null`. There is
nothing on the npm registry to upgrade to, so this project replaces the
registry copy with this patched copy through the `overrides` field in the
root `package.json`:

```json
"overrides": {
  "braces": "file:vendor/braces"
}
```

`braces` is transitive here. Two packages pull it in: `chokidar@3.6.0`
(`~3.0.2`, used by webpack for file watching) and `micromatch@4.0.8`
(`^3.0.3`, used for glob matching throughout the Docusaurus build). Neither
can drop the dependency, so replacement at the lockfile level is the whole
fix.

## What changed relative to 3.0.3

The version is bumped to 3.0.4, the next patch version, so the lockfile
records a version outside the vulnerable range.

1. `lib/constants.js` - new constant `MAX_DEPTH: 100`.

2. `lib/parse.js` - the parser now counts total nesting depth (curly braces
   and parentheses, which both become nested AST nodes) and throws a
   `RangeError` when the depth exceeds `maxDepth`, mirroring the existing
   `maxLength` guard. Callers may lower the limit with `options.maxDepth`;
   like `maxLength`, they cannot raise it above `MAX_DEPTH`.

3. `lib/compile.js`, `lib/expand.js`, `lib/stringify.js` - the recursive
   walkers take a depth argument and throw a `RangeError` when it exceeds
   `maxDepth`. These guards cover the public AST entry points
   (`braces.compile(ast)`, `braces.expand(ast)`, `braces.stringify(ast)`),
   which bypass `parse` when handed an AST directly.

Depth 100 is far below the call stack headroom of any Node.js version this
project runs on (measured headroom starts around 9000 frames on Node 20 and
26) and far above any nesting a real glob pattern needs. The failure mode
changes from an uncatchable stack exhaustion at unbounded depth to a
catchable `RangeError` thrown at depth 101, independent of the platform.

## Files unchanged from 3.0.3

`index.js`, `lib/utils.js`, `LICENSE`, `README.md`, and the rest of
`package.json` are verbatim from the published 3.0.3 tarball.

## Replacing this copy when upstream publishes a fix

When `micromatch/braces` publishes a version above 3.0.3, delete this
directory and the `overrides` entry, then run `npm install` to restore the
registry copy. The regression test `tests/braces-security.test.mjs` pins the
behaviour this copy must keep.
