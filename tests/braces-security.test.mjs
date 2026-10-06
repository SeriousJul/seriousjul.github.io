/**
 * Regression checks for the braces replacement in package-lock.json.
 *
 * Covers CVE-2026-93687 (GHSA-vfj7-8cjw-p6xm, high, CVSS 7.5). The recursive
 * AST walkers in braces (compile, expand, stringify) had no depth guard.
 * The only input limit was the character count: 10000. A pattern whose
 * nesting is deep but whose length stays under that limit can nest 4999
 * levels in 9999 characters, which exhausts the V8 call stack and kills
 * the Node.js process with an uncaught
 * `RangeError: Maximum call stack size exceeded`. Measured on Node 20, the
 * CI runtime, `braces.compile` and `braces.stringify` crash on a 4999-deep
 * parenthesised pattern. Whether a given pattern crashes also depends on
 * the Node version and how much stack the caller already holds, so the
 * library, not the platform, has to bound the depth.
 *
 * There is no patched version to upgrade to. As of 2026-10-06 the latest
 * release is 3.0.3, the last version in the vulnerable range `<= 3.0.3`,
 * and upstream issue micromatch/braces#70 is still open. The registry copy
 * is therefore replaced with a vendored copy of 3.0.3 plus depth guards
 * (see vendor/braces/PATCH-NOTES.md), wired in from the root manifest:
 *
 *     "dependencies": { "braces": "file:vendor/braces" },
 *     "overrides":    { "braces": "$braces" }
 *
 * The override is what reaches the two transitive consumers, chokidar
 * (~3.0.2, webpack's file watcher) and micromatch (^3.0.3, glob matching
 * throughout the Docusaurus build).
 *
 * Dependency security check, not a frontend test. It uses the node:test
 * runner built into Node, so it adds no dependency. It reads braces from
 * the project node_modules, so it exercises exactly the version the
 * committed lockfile resolves.
 *
 * Run after `npm ci`, through npm or directly:
 *
 *     npm test
 *     node tests/braces-security.test.mjs
 *
 * Verified behaviour of this file:
 *
 *   3.0.3   the registry version, and the whole vulnerable range
 *           on Node 20 the no-catch 4999-deep paren probe below kills the
 *           process with an uncaught "Maximum call stack size exceeded";
 *           on Node 26 the default stack is deeper and the same probe
 *           survives, which is the non-determinism the CVE describes
 *   3.0.4   this vendored copy
 *           every deep probe throws a RangeError at nesting depth 101 on
 *           every Node version, catchable at the call site, and patterns
 *           nested 100 or less behave identically to 3.0.3
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const braces = require('braces');
const { version } = require('braces/package.json');

// The advisory range is `<= 3.0.3` and no patched release exists, so the
// floor is the next patch version, which the vendored copy declares.
const MINIMUM_VERSION = '3.0.4';

// The hard cap the vendored copy enforces. Patterns nested at or below it
// must behave exactly as in 3.0.3.
const MAX_DEPTH = 100;

// The guard rejects beyond this depth. Every security assertion reads the
// message, not just the throw, because stack exhaustion throws a
// RangeError too and "it threw" is not evidence of the guard.
const GUARD_MESSAGE = /exceeds max depth/;
const STACK_EXHAUSTION = /Maximum call stack size exceeded/;

/** The three numeric parts of a version string. */
function semverParts(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text);
  assert.ok(match, `unrecognised braces version: ${text}`);
  return match.slice(1).map(Number);
}

/** True when `a` is at or above `b`, compared numerically per part. */
function isAtOrAbove(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

/** True when `candidate` satisfies a plain tilde or caret range. */
function satisfiesRange(candidate, range) {
  const parts = semverParts(candidate);
  const tilde = /^~(\d+)\.(\d+)\.(\d+)$/.exec(range);
  if (tilde) {
    const [maj, min] = tilde.slice(1).map(Number);
    return (
      parts[0] === maj &&
      parts[1] === min &&
      isAtOrAbove(parts, tilde.slice(1).map(Number))
    );
  }
  const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range);
  if (caret) {
    return (
      parts[0] === Number(caret[1]) &&
      isAtOrAbove(parts, caret.slice(1).map(Number))
    );
  }
  assert.fail(`range this check cannot judge: ${range}`);
}

/** A nested brace pattern: `a` + `{b`xN + `}`xN, which is 3N+1 characters. */
function nestedBraces(depth) {
  return 'a' + '{b'.repeat(depth) + '}'.repeat(depth);
}

/** A nested paren pattern: `(`xN + `a` + `)`xN, which is 2N+1 characters. */
function nestedParens(depth) {
  return '('.repeat(depth) + 'a' + ')'.repeat(depth);
}

/** Run braces in-process and report the failure instead of throwing. */
function runGuarded(pattern, options) {
  try {
    braces(pattern, options);
    return { kind: 'ok' };
  } catch (error) {
    return {
      kind: 'error',
      name: error.constructor.name,
      message: error.message,
    };
  }
}

/**
 * Run `braces(pattern)` in a child process with no catch, the way the real
 * call sites in chokidar and micromatch use it.
 *
 * A catchable error at bounded depth and an uncatchable stack exhaustion
 * both kill a bare call site, so the test reads the failure message to
 * tell the two apart.
 */
function runUncatched(pattern) {
  const child = [
    "const braces = require('braces');",
    'braces(process.argv[1]);',
    "process.stdout.write('ALIVE\\n');",
  ].join('\n');
  try {
    execFileSync(process.execPath, ['-e', child, pattern], {
      encoding: 'utf8',
      cwd: repoRoot,
    });
    return { died: false };
  } catch (error) {
    return {
      died: true,
      status: error.status,
      stderr: (error.stderr || '').toString(),
    };
  }
}

/** The `braces` entries in the committed lockfile, keyed by install path. */
function lockfileBracesEntries() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
  );
  const entries = Object.entries(lock.packages).filter(([key]) =>
    /(^|\/)braces$/.test(key)
  );
  assert.ok(
    entries.length > 0,
    'package-lock.json has no braces entry at all, so this test is not ' +
      'looking at the manifest the advisory points at'
  );
  return entries;
}

describe(`lockfile replacement: braces must sit outside <= 3.0.3 (${version})`, () => {
  it(`installs at least ${MINIMUM_VERSION}, outside the vulnerable range`, () => {
    assert.ok(
      isAtOrAbove(semverParts(version), semverParts(MINIMUM_VERSION)),
      `braces ${version} is inside the vulnerable range <= 3.0.3, so ` +
        `CVE-2026-93687 stays open. The vendored copy declares ` +
        `${MINIMUM_VERSION}, the next patch version after the last published one.`
    );
  });

  it('resolves to exactly one copy, and it is the vendored patched copy', () => {
    const entries = lockfileBracesEntries();
    assert.deepEqual(
      entries.map(([key]) => key).sort(),
      ['node_modules/braces', 'vendor/braces'],
      `the lockfile holds an unexpected set of braces entries ` +
        `(${entries.map(([key]) => key).join(', ')}). A registry copy or a ` +
        `second nested copy would be a second resolved version that this ` +
        `replacement does not cover.`
    );
    const byKey = Object.fromEntries(entries);
    const vendored = byKey['vendor/braces'];
    assert.equal(
      vendored.version,
      version,
      `vendor/braces says ${vendored.version} but node_modules holds ` +
        `${version}, so the version this file proves safe is not the ` +
        `version a fresh CI \`npm ci\` will install.`
    );
    const linked = byKey['node_modules/braces'];
    assert.equal(linked.link, true, 'node_modules/braces is not a link');
    assert.equal(
      linked.resolved,
      'vendor/braces',
      `node_modules/braces resolves to ${linked.resolved}, not the vendored copy`
    );
    for (const [key, entry] of entries) {
      assert.ok(
        !String(entry.resolved || '').startsWith(
          'https://registry.npmjs.org/braces'
        ),
        `${key} still resolves to a registry copy of braces, the vulnerable source`
      );
    }
  });

  it('pins the replacement in the root manifest, not just the lockfile', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    );
    assert.equal(
      manifest.dependencies?.braces,
      'file:vendor/braces',
      'the root manifest no longer points braces at the vendored copy, so ' +
        'the next install can replace it with the registry version'
    );
    assert.equal(
      manifest.overrides?.braces,
      '$braces',
      'the root manifest no longer overrides transitive braces with the ' +
        'direct dependency, so chokidar and micromatch can install their own ' +
        'registry copies'
    );
  });

  it('keeps every dependent range satisfied, so a reinstall cannot roll it back', () => {
    const lock = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
    );
    const ranges = [];
    for (const [key, entry] of Object.entries(lock.packages)) {
      if (key === '') continue; // the root copy is the replacement, not a consumer
      for (const field of [
        'dependencies',
        'peerDependencies',
        'optionalDependencies',
      ]) {
        const declared = entry[field]?.['braces'];
        if (declared) ranges.push([key || '(root)', declared]);
      }
    }
    assert.ok(
      ranges.length >= 2,
      `expected the known braces consumers to appear in the lockfile, ` +
        `found ${ranges.length}`
    );
    for (const [consumer, range] of ranges) {
      assert.ok(
        satisfiesRange(version, range),
        `${consumer} requires braces ${range}, and the replaced ${version} ` +
          `does not satisfy it, so a fresh install would replace the vendored copy`
      );
    }
  });

  it('exposes the API surface the consumers call', () => {
    // micromatch calls the main function, .parse, .compile, .expand and
    // .stringify; chokidar calls the main function. 3.0.4 dropped nothing
    // relative to 3.0.3, so the replacement is API compatible.
    for (const name of ['parse', 'compile', 'expand', 'stringify']) {
      assert.equal(
        typeof braces[name],
        'function',
        `braces ${version} no longer exports ${name}()`
      );
    }
    assert.equal(typeof braces, 'function');
  });
});

describe('CVE-2026-93687: the walkers stop at a bounded depth', () => {
  it('rejects deeply nested braces that fit under the character limit', () => {
    // 3333 levels is the deepest brace nesting that fits under the 10000
    // character limit: 3 * 3333 + 1 = 10000.
    const pattern = nestedBraces(3333);
    assert.equal(pattern.length, 10000);
    const result = runGuarded(pattern);
    assert.equal(
      result.kind,
      'error',
      'the deeply nested pattern did not fail at all'
    );
    assert.equal(result.name, 'RangeError');
    assert.match(
      result.message,
      GUARD_MESSAGE,
      `the pattern failed, but not at the depth guard, so the guard is not ` +
        `the thing bounding the walk. Message: ${result.message}`
    );
    assert.doesNotMatch(result.message, STACK_EXHAUSTION);
  });

  it('rejects deeply nested parentheses that fit under the character limit', () => {
    // 4999 levels is the deepest paren nesting that fits under the limit:
    // 2 * 4999 + 1 = 9999. This is the probe that kills the vulnerable
    // version on Node 20 in the no-catch test below.
    const pattern = nestedParens(4999);
    assert.equal(pattern.length, 9999);
    const result = runGuarded(pattern);
    assert.equal(
      result.kind,
      'error',
      'the deeply nested pattern did not fail at all'
    );
    assert.equal(result.name, 'RangeError');
    assert.match(
      result.message,
      GUARD_MESSAGE,
      `the pattern failed, but not at the depth guard, so the guard is not ` +
        `the thing bounding the walk. Message: ${result.message}`
    );
    assert.doesNotMatch(result.message, STACK_EXHAUSTION);
  });

  it('fails a bare call site at the guard, not at the stack limit', () => {
    // chokidar and micromatch do not catch RangeError, so the probe runs
    // the pattern in a child process with no catch. Both the guard and the
    // old stack exhaustion kill that process; only the message tells them
    // apart. On the vulnerable version, Node 20 dies with
    // "Maximum call stack size exceeded" here.
    const result = runUncatched(nestedParens(4999));
    assert.ok(result.died, 'the bare call site survived the deep pattern');
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      GUARD_MESSAGE,
      `the child died with a different error, so the guard did not bound ` +
        `the walk. stderr: ${result.stderr.slice(0, 300)}`
    );
    assert.doesNotMatch(result.stderr, STACK_EXHAUSTION);
  });

  it(`accepts nesting at exactly ${MAX_DEPTH}, rejects ${MAX_DEPTH + 1}`, () => {
    // The limit is a ceiling on legitimate patterns, not a ban on deep
    // ones. The row at the limit is the negative control: it proves the
    // rejection above it is the depth guard and not a blanket refusal.
    const atLimit = runGuarded(nestedBraces(MAX_DEPTH));
    assert.equal(
      atLimit.kind,
      'ok',
      `the copy rejects a pattern nested at its own limit${
        atLimit.kind === 'error' ? `: ${atLimit.message}` : ''
      }`
    );
    const overLimit = runGuarded(nestedBraces(MAX_DEPTH + 1));
    assert.equal(overLimit.kind, 'error');
    assert.equal(overLimit.name, 'RangeError');
    assert.match(overLimit.message, GUARD_MESSAGE);
  });

  it('lets callers lower the depth limit, never raise it', () => {
    const lowered = runGuarded(nestedBraces(60), { maxDepth: 50 });
    assert.equal(lowered.kind, 'error');
    assert.match(lowered.message, /exceeds max depth \(50\)/);

    const raised = runGuarded(nestedBraces(300), { maxDepth: 99999 });
    assert.equal(raised.kind, 'error');
    assert.match(
      raised.message,
      new RegExp(`exceeds max depth \\(${MAX_DEPTH}\\)`),
      'options.maxDepth raised the hard cap, so a caller could re-open the ' +
        'unbounded walk'
    );
  });

  it('guards the direct AST entry points, which bypass the parser', () => {
    // braces.compile(ast), braces.expand(ast) and braces.stringify(ast)
    // accept an AST directly, so the parser guard alone cannot bound them.
    let chain = { type: 'text', value: 'a' };
    for (let i = 0; i < 150; i += 1) {
      chain = {
        type: 'brace',
        open: true,
        close: true,
        invalid: false,
        commas: 1,
        nodes: [
          { type: 'open', value: '{' },
          chain,
          { type: 'close', value: '}' },
        ],
      };
    }
    for (const api of ['compile', 'stringify']) {
      const result = (() => {
        try {
          braces[api](chain);
          return { kind: 'ok' };
        } catch (error) {
          return {
            kind: 'error',
            name: error.constructor.name,
            message: error.message,
          };
        }
      })();
      assert.equal(
        result.kind,
        'error',
        `braces.${api}(ast) accepted a 150-deep AST`
      );
      assert.equal(result.name, 'RangeError');
      assert.match(
        result.message,
        GUARD_MESSAGE,
        `braces.${api}(ast) failed, but not at the depth guard. Message: ` +
          `${result.message}`
      );
      assert.doesNotMatch(result.message, STACK_EXHAUSTION);
    }
    const root = { type: 'root', input: '', nodes: [chain] };
    let expandResult;
    try {
      braces.expand(root);
      expandResult = { kind: 'ok' };
    } catch (error) {
      expandResult = {
        kind: 'error',
        name: error.constructor.name,
        message: error.message,
      };
    }
    assert.equal(
      expandResult.kind,
      'error',
      'braces.expand(ast) accepted a 150-deep AST'
    );
    assert.match(expandResult.message, GUARD_MESSAGE);
    assert.doesNotMatch(expandResult.message, STACK_EXHAUSTION);
  });

  it('expands ordinary patterns exactly as 3.0.3 did', () => {
    // The guard must change nothing for real input. These are the shapes
    // the Docusaurus build and webpack pass through braces every run,
    // plus a range and the boundary-depth pattern from the test above.
    assert.deepEqual(braces('{a,b,c}'), ['(a|b|c)']);
    assert.equal(braces.compile('a/{b,c}/d'), 'a/(b|c)/d');
    assert.deepEqual(braces.expand('a/{b,c}/d'), ['a/b/d', 'a/c/d']);
    assert.deepEqual(braces.expand('user-{1..3}'), [
      'user-1',
      'user-2',
      'user-3',
    ]);
    assert.deepEqual(braces('user-{1..3}'), ['user-([1-3])']);
    assert.equal(braces.stringify('a/{b,c}/d'), 'a/{b,c}/d');
    const atLimit = runGuarded(nestedBraces(MAX_DEPTH), { expand: true });
    assert.equal(
      atLimit.kind,
      'ok',
      `the copy rejects a pattern nested at its own limit${
        atLimit.kind === 'error' ? `: ${atLimit.message}` : ''
      }`
    );
  });
});
