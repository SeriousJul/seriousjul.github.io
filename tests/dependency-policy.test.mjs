/**
 * Dependency policy guard for this repository.
 *
 * ADR-0001 (docs/adr/0001-no-local-patches-to-third-party-dependencies.md)
 * forbids the local patch: this project never changes third-party source
 * and never installs it in place of the registry copy. A `file:` or
 * `link:` dependency, a bare path, a git URL, a `github:` shorthand, or a
 * tarball URL is a local patch, and a fork dependency is a local patch
 * parked elsewhere. So no spec in `dependencies`, `devDependencies` or
 * `overrides` may be anything other than a plain registry semver range.
 * The sanctioned answers to an advisory, in order, are a registry version
 * pin in `overrides`, a reachability analysis, and replacement of the
 * dependency or of the code path that reaches it.
 *
 * The guard also fails when a path under `vendor/` is tracked in git. The
 * folder that held the removed local patches (hand-patched copies of
 * braces 3.0.4 and http-cache-semantics 4.3.1) is gitignored, but the
 * gitignore alone does not keep the index clean: a path that is already
 * tracked is not ignored. This test is what catches a re-added path.
 *
 * Dependency policy check, not a frontend test. It uses the node:test
 * runner built into Node, so it adds no dependency. It reads the committed
 * manifest and the git index, so it exercises exactly the tree this branch
 * ships.
 *
 * Run after `npm ci`, through npm or directly:
 *
 *     npm test
 *     node tests/dependency-policy.test.mjs
 *
 * Verified behaviour of this file:
 *
 *   current tree        every spec in dependencies, devDependencies and
 *                       overrides is a plain registry semver range, and no
 *                       path under vendor/ is tracked, so the guard passes
 *   a file: spec        "braces": "file:vendor/braces" in dependencies
 *                       fails the spec check
 *   a github: spec      "braces": "github:micromatch/braces" in
 *                       dependencies fails the spec check
 *   a tracked vendor/   a force-added vendor/anything path makes the index
 *                       check fail even with vendor/ in .gitignore, because
 *                       a tracked path is not ignored
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
);

/** The manifest sections this policy covers. */
const SECTIONS = ['dependencies', 'devDependencies', 'overrides'];

/**
 * The name of the non-registry source a spec points at, or null when the
 * spec is a plain registry semver range.
 *
 * The categories are the ways a spec can select source that is not a
 * published registry version: local paths (`file:`, `link:`, bare paths,
 * relative paths, absolute paths), git remotes (`git+` URLs, `git@` scp
 * form, `github:` / `gitlab:` / `bitbucket:` shorthands), and tarball or
 * other remote URLs (`https:`, `http:`, `ssh:`). Anything else that is not
 * a semver range is reported as such.
 */
function classifySpec(spec) {
  if (typeof spec !== 'string') return 'not a spec string';
  const text = spec.trim();
  if (text === '') return 'empty spec';
  if (/^(?:file|link):/i.test(text)) return 'local path spec';
  if (/^workspace:/i.test(text)) return 'workspace spec';
  if (/^git\+/i.test(text) || /^git@/i.test(text)) return 'git URL';
  if (/^(?:github|gitlab|bitbucket):/i.test(text)) return 'git shorthand';
  if (/^(?:https?|ssh|ftp):\/\//i.test(text)) return 'tarball or remote URL';
  if (/^[a-z][a-z0-9+.-]*:/.test(text)) return 'URL scheme';
  if (/^\//.test(text)) return 'absolute path';
  if (/^\.{1,2}\//.test(text)) return 'relative path';
  if (text.includes('/')) return 'path';
  if (!isPlainRegistryRange(spec)) return 'not a plain registry semver range';
  return null;
}

// One comparator of a plain semver range: an optional operator followed by
// a version whose parts are numbers or x-wildcards, with an optional
// prerelease and build suffix. Missing parts are legal and mean 0 or x.
const NUM = '(?:0|[1-9]\\d*)';
const PART = '(?:[xX*]|' + NUM + ')';
const VERSION =
  PART +
  '(?:\\.' +
  PART +
  '(?:\\.' +
  PART +
  '(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?' +
  '(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?' +
  ')?)?';
const COMPARATOR = new RegExp('^(?:=|>=|<=|>|<|~|\\^)?' + VERSION + '$');

/** True when the spec selects a published registry version by semver only. */
function isPlainRegistryRange(spec) {
  if (typeof spec !== 'string') return false;
  const text = spec.trim();
  if (text === '') return false;
  return text.split('||').every(alternative =>
    alternative
      // A dash range is two comparators separated by " - ".
      .split(/\s+-\s+/)
      .every(side =>
        side
          .trim()
          .split(/\s+/)
          .every(token => COMPARATOR.test(token))
      )
  );
}

/** The tracked paths under vendor/, read from the git index. */
function trackedVendorPaths() {
  try {
    const out = execFileSync('git', ['ls-files', '--', 'vendor/'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return out.split('\n').filter(line => line !== '');
  } catch (error) {
    assert.fail(
      'cannot read the git index, so the vendor/ tracking check cannot ' +
        `run: ${error.message}`
    );
  }
}

describe('dependency policy: the guard rejects non-registry specs', () => {
  it('rejects every shape of local and remote source', () => {
    const banned = [
      'file:vendor/braces',
      'link:vendor/braces',
      'vendor/braces',
      './vendor/braces',
      '../vendor/braces',
      '/home/user/repo/vendor/braces',
      'git+https://github.com/seriousjul/braces.git',
      'git+ssh://git@github.com/seriousjul/braces.git',
      'git@github.com:seriousjul/braces.git',
      'github:micromatch/braces',
      'gitlab:seriousjul/braces',
      'https://registry.npmjs.org/braces/-/braces-3.0.4-patched.tgz',
      'http://example.com/braces.tgz',
      'ssh://git@example.com/braces.git',
    ];
    for (const spec of banned) {
      assert.equal(
        isPlainRegistryRange(spec),
        false,
        `the guard accepted ${JSON.stringify(spec)}, so a ${classifyFallback(spec)} could pass the policy check`
      );
      assert.notEqual(
        classifySpec(spec),
        null,
        `the guard could not name why ${JSON.stringify(spec)} is banned`
      );
    }
  });

  it('accepts the plain registry ranges this manifest already carries', () => {
    const allowed = [
      '3.10.2',
      '^3.0.0',
      '~6.0.2',
      '7.1.6',
      '2.1.2',
      '>=20.0',
      '1.2.3 - 2.0.0',
      '1.x',
      '*',
      '^1.0.0 || ^2.0.0',
      '1.0.0-beta.1',
    ];
    for (const spec of allowed) {
      assert.equal(
        isPlainRegistryRange(spec),
        true,
        `the guard rejected ${JSON.stringify(spec)}, a plain registry range`
      );
      assert.equal(
        classifySpec(spec),
        null,
        `the guard named ${JSON.stringify(spec)} as banned: ${classifySpec(spec)}`
      );
    }
  });
});

describe('dependency policy: package.json', () => {
  it('no dependencies, devDependencies or overrides spec points outside the registry', () => {
    const violations = [];
    for (const section of SECTIONS) {
      const specs = manifest[section];
      if (specs === undefined) continue;
      assert.equal(
        typeof specs,
        'object',
        `package.json ${section} is not an object of spec strings`
      );
      for (const [name, spec] of Object.entries(specs)) {
        const reason = classifySpec(spec);
        if (reason !== null) {
          violations.push(
            `${section}.${name} = ${JSON.stringify(spec)} (${reason})`
          );
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      'the manifest carries specs that install source from outside the ' +
        'registry. ADR-0001 (docs/adr/0001-no-local-patches-to-third-party-' +
        'dependencies.md) forbids the local patch: select a published ' +
        'registry version in overrides, or replace the dependency. ' +
        'Offending specs:\n  ' +
        violations.join('\n  ')
    );
  });
});

describe('dependency policy: the git index', () => {
  it('no path under vendor/ is tracked', () => {
    const tracked = trackedVendorPaths();
    assert.deepEqual(
      tracked,
      [],
      'paths under vendor/ are tracked in git. Delete them with `git rm` ' +
        'and commit the deletion: this project never carries third-party ' +
        'source, patched or not (ADR-0001). Tracked paths:\n  ' +
        tracked.join('\n  ')
    );
  });
});

/**
 * A short label for the rejection assertion above. It is a static list,
 * not a call back into classifySpec, so the test stays meaningful if
 * classifySpec changes.
 */
function classifyFallback(spec) {
  if (/^(?:file|link):/i.test(spec)) return 'local path spec';
  if (/^git\+/i.test(spec) || /^git@/i.test(spec)) return 'git URL';
  if (/^(?:github|gitlab|bitbucket):/i.test(spec)) return 'git shorthand';
  if (/^(?:https?|ssh|ftp):\/\//i.test(spec)) return 'tarball or remote URL';
  if (spec.includes('/')) return 'path';
  return 'non-registry spec';
}
