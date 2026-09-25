/**
 * Regression checks for the js-yaml pin in package-lock.json.
 *
 * Covers CVE-2026-84375 (GHSA-2883-xcg3-v3hh, high, CVSS 7.5). The
 * `maxTotalMergeKeys` budget added in 4.3.0 charged one unit per *folded key*,
 * so a merge source that folds no keys, meaning an empty mapping `{}`, was
 * free. A document that aliases one large sequence of empty mappings and merges
 * it into many targets did O(sources x targets) work while the counter never
 * moved, so no configured limit could stop it. 4.3.2 charges one unit per merge
 * source as well as per key. See nodeca/js-yaml#797.
 *
 * js-yaml is transitive here. Five packages in the tree require `^4.1.0`:
 * `@docusaurus/utils`, `@docusaurus/utils-validation`,
 * `@docusaurus/plugin-content-docs`, `cosmiconfig` and `@11ty/gray-matter`,
 * the last of them behind the Docusaurus front matter parser. The lockfile
 * resolves all five to one flat copy, so this pin is the whole fix.
 *
 * Dependency security check, not a frontend test. It uses the node:test runner
 * built into Node, so it adds no dependency. It reads js-yaml from the project
 * node_modules, so it exercises exactly the version the committed lockfile
 * resolves.
 *
 * Run after `npm ci`, through npm or directly:
 *
 *     npm test
 *     node tests/js-yaml-security.test.mjs
 *
 * Verified behaviour of this file against the five versions that matter, each
 * measured by swapping that version into the project node_modules and
 * re-running this file. 20 leaf tests per run:
 *
 *   4.1.1   the replaced version    fails 10 of 20  maxTotalMergeKeys does not
 *                                                   exist at all yet, so every
 *                                                   budget probe parses and the
 *                                                   option is ignored silently
 *   4.2.0   fails 9 of 20           as above; only the new merge-sequence cap
 *                                                   stops the advisory PoC, and
 *                                                   that row accepts any guard
 *   4.3.0   fails 10 of 20          the budget exists but an empty source is
 *                                                   free, which is this CVE
 *   4.3.1   fails 10 of 20          same, and this is what the three older
 *                                                   js-yaml advisories asked for
 *   4.3.2   this pin                passes 20 of 20
 *
 * The 4.3.1 row is the point of the version floor. 4.3.1 clears the three older
 * js-yaml advisories still open on this repo, and it satisfies every "the parser
 * still works" assertion below, because CVE-2026-84375 is a resource-accounting
 * defect with no observable difference in the output of a well-formed document.
 * Without the floor and the budget-probing tests, this file cannot tell the pin
 * it defends from a pin that leaves the advisory open.
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

const yaml = require('js-yaml');
const { load } = yaml;
const { version } = require('js-yaml/package.json');

// CVE-2026-84375 first patched, and the only version that counts an empty
// merge source against the budget.
const MINIMUM_PIN = '4.3.2';

// The loader's own default. Every assertion that omits options relies on it,
// because that is what this repo's real call sites get.
const DEFAULT_BUDGET = 10000;

/** One aliasable sequence of `count` empty flow mappings. */
function emptySources(count) {
  return `arr: &arr [${Array.from({ length: count }, () => '{}').join(', ')}]\n`;
}

/** A document that merges `perTarget` empty mappings into `targets` mappings. */
function emptyMergeDocument(perTarget, targets) {
  return (
    emptySources(perTarget) + 'targets:\n' + '  - <<: *arr\n'.repeat(targets)
  );
}

/** A mapping whose single merge source has `keyCount` keys. */
function keyedSourceDocument(keyCount) {
  const keys = Array.from({ length: keyCount }, (_, i) => `k${i}: ${i}`);
  return `s: &s {${keys.join(', ')}}\nm:\n  <<: *s\n`;
}

/**
 * Load `src` and report what happened instead of throwing.
 *
 * Every security assertion here has to read the failure message, not just the
 * fact that the loader threw. An unrelated guard can reject the same document
 * for a reason that has nothing to do with this CVE, and 4.2.0 does exactly
 * that, so "it threw" is not evidence that the budget accounting is fixed.
 *
 * @returns {{kind: 'parsed', doc: unknown} | {kind: 'error', name: string, message: string}}
 */
function runLoad(src, options) {
  try {
    return { kind: 'parsed', doc: load(src, options) };
  } catch (error) {
    return {
      kind: 'error',
      name: error.constructor.name,
      message: error.message,
    };
  }
}

/** Assert the loader stopped `src` by exhausting the merge-key budget. */
function assertBudgetExceeded(what, src, options) {
  assertRejected(what, src, /merge keys exceeded maxTotalMergeKeys/, options, {
    why: 'the budget accounting this CVE fixed is still untested',
  });
}

/**
 * Assert the loader refused `src`, and say which guard has to be seen.
 *
 * `guard` is a regex over the message, because the check that fires is the
 * thing under test, not merely the refusal.
 */
function assertRejected(what, src, guard, options, { why } = {}) {
  const result = runLoad(src, options);
  if (result.kind === 'parsed') {
    assert.fail(
      `${what}: the loader parsed this document in full, so nothing bounded ` +
        `the merge work in it. That is CVE-2026-84375.`
    );
  }
  assert.equal(
    result.name,
    'YAMLException',
    `${what}: expected a YAMLException, got ${result.name}: ${result.message}`
  );
  assert.match(
    result.message,
    guard,
    `${what}: the document was rejected, but by a different guard, so ${why}. ` +
      `Message: ${result.message}`
  );
}

/** Assert the loader parsed `src` and return the document. */
function assertParsed(what, src, options) {
  const result = runLoad(src, options);
  assert.equal(
    result.kind,
    'parsed',
    `${what}: the pinned js-yaml rejected a document this site needs to parse: ` +
      (result.kind === 'error' ? result.message : '')
  );
  return result.doc;
}

/** The three numeric parts of a version string. */
function semverParts(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text);
  assert.ok(match, `unrecognised js-yaml version: ${text}`);
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

/** True when `candidate` satisfies a `^major.minor.patch` range. */
function satisfiesCaret(candidate, range) {
  const wanted = /^(\d+)\.(\d+)\.(\d+)$/.exec(range.slice(1));
  assert.ok(
    wanted,
    `not a plain caret range, so this check cannot judge it: ${range}`
  );
  const [maj, min, pat] = semverParts(candidate);
  if (maj !== Number(wanted[1])) return false;
  const lower = [Number(wanted[1]), Number(wanted[2]), Number(wanted[3])];
  return isAtOrAbove([maj, min, pat], lower);
}

/**
 * The `node_modules/js-yaml` entries in the committed lockfile.
 *
 * A flat npm lockfile holds one entry per install path, so a second key that
 * ends in `/js-yaml` would be a nested copy at a different version, and the
 * pin in the top-level entry would not cover it.
 */
function lockfileJsYamlEntries() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
  );
  const entries = Object.entries(lock.packages).filter(([key]) =>
    /(^|\/)js-yaml$/.test(key)
  );
  assert.ok(
    entries.length > 0,
    'package-lock.json has no js-yaml entry at all, so this test is not ' +
      'looking at the manifest the advisory points at'
  );
  return entries;
}

describe(`lockfile pin: js-yaml must sit outside >= 4.0.0, < 4.3.2 (${version})`, () => {
  it(`is at least ${MINIMUM_PIN}, first patched for CVE-2026-84375`, () => {
    assert.ok(
      isAtOrAbove(semverParts(version), semverParts(MINIMUM_PIN)),
      `js-yaml ${version} is below ${MINIMUM_PIN}, so an empty merge source ` +
        `still costs zero budget units and CVE-2026-84375 stays open. 4.3.1 ` +
        `clears the older js-yaml advisories and passes every behavioural and ` +
        `compatibility check in this file, so this floor is the only thing ` +
        `that separates the two pins.`
    );
  });

  it('resolves to exactly one flat copy, and it is the copy under test', () => {
    const entries = lockfileJsYamlEntries();
    assert.equal(
      entries.length,
      1,
      `the lockfile holds ${entries.length} js-yaml entries ` +
        `(${entries.map(([key]) => key).join(', ')}). A nested copy is a ` +
        `second resolved version that this pin does not cover.`
    );
    const [key, entry] = entries[0];
    assert.equal(
      entry.version,
      version,
      `${key} says ${entry.version} but node_modules holds ${version}, so ` +
        `the version this file proves safe is not the version a fresh CI ` +
        `\`npm ci\` will install.`
    );
    assert.equal(
      entry.resolved,
      `https://registry.npmjs.org/js-yaml/-/js-yaml-${version}.tgz`,
      `${key} resolves to an unexpected URL for ${version}`
    );
  });

  it('keeps every dependent range satisfied, so a reinstall cannot roll it back', () => {
    const lock = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
    );
    const ranges = [];
    for (const [key, entry] of Object.entries(lock.packages)) {
      for (const field of [
        'dependencies',
        'peerDependencies',
        'optionalDependencies',
      ]) {
        const declared = entry[field]?.['js-yaml'];
        if (declared) ranges.push([key || '(root)', declared]);
      }
    }
    assert.ok(
      ranges.length >= 5,
      `expected the five known js-yaml consumers to appear in the lockfile, ` +
        `found ${ranges.length}`
    );
    for (const [consumer, range] of ranges) {
      assert.ok(
        satisfiesCaret(version, range),
        `${consumer} requires js-yaml ${range}, and the pinned ${version} does ` +
          `not satisfy it, so a fresh install would replace this pin`
      );
    }
  });

  it('exposes the API surface the consumers call', () => {
    // The four @docusaurus call sites use load() and dump(); @11ty/gray-matter
    // uses both, and cosmiconfig uses load(). 4.2.0 dropped nothing and 4.3.2
    // dropped nothing, so the bump is API compatible. This fails loudly if a
    // future pin moves to the 5.x line, where the merge default changes.
    for (const name of ['load', 'loadAll', 'dump', 'safeLoad', 'safeDump']) {
      assert.equal(
        typeof yaml[name],
        'function',
        `js-yaml ${version} no longer exports ${name}()`
      );
    }
  });
});

describe('CVE-2026-84375: the budget charges one unit per merge source', () => {
  // These probes read the accounting directly, at a budget small enough to see
  // the off-by-one that the CVE describes. On 4.3.0 and 4.3.1 an empty source
  // is free, so the "@0" and "@1" rows below parse; on 4.3.2 they do not. The
  // "@2" row is the negative control: it proves the throw is the budget
  // accounting and not a blanket ban on merge sequences.

  it('charges one unit for a single empty source', () => {
    assertBudgetExceeded(
      '1 empty source at budget 0',
      emptyMergeDocument(1, 1),
      { maxTotalMergeKeys: 0 }
    );
    assertParsed('1 empty source at budget 1', emptyMergeDocument(1, 1), {
      maxTotalMergeKeys: 1,
    });
  });

  it('charges one unit per empty source, not one per document', () => {
    assertBudgetExceeded(
      '2 empty sources at budget 1',
      emptyMergeDocument(2, 1),
      { maxTotalMergeKeys: 1 }
    );
    assertParsed('2 empty sources at budget 2', emptyMergeDocument(2, 1), {
      maxTotalMergeKeys: 2,
    });
  });

  it(`counts 100 empty sources as 100 units against the default ${DEFAULT_BUDGET}`, () => {
    // The cost of N sources merged K times is N * K units. At 100 x 100 that is
    // exactly the default budget, which the loader permits; one more target
    // crosses it. A pin that still charged empty sources zero would parse both.
    assertParsed(
      `100 sources x 100 targets, exactly ${DEFAULT_BUDGET} units`,
      emptyMergeDocument(100, 100)
    );
    assertBudgetExceeded(
      '100 sources x 101 targets, 10100 units',
      emptyMergeDocument(100, 101)
    );
  });

  it('charges a non-empty source one unit on top of its own keys', () => {
    // A 4 key source costs 5 units: 1 for the source plus 1 per folded key. At
    // budget 4 the 4.3.0 and 4.3.1 accounting (keys only) fits, so this is the
    // tightest single statement of what 4.3.2 changed.
    assertBudgetExceeded(
      '1 source with 4 keys at budget 4',
      keyedSourceDocument(4),
      { maxTotalMergeKeys: 4 }
    );
    assertParsed('1 source with 4 keys at budget 5', keyedSourceDocument(4), {
      maxTotalMergeKeys: 5,
    });
  });
});

describe('CVE-2026-84375: repeated empty merges cannot run unbounded', () => {
  it('refuses the advisory PoC shape', () => {
    // The published proof: 20000 empty mappings aliased into 20000 targets, a
    // document of roughly 300 KB that costs O(N * K) to resolve. On 4.1.1, the
    // version this pin replaces, it parsed in 1.8 s on this machine.
    //
    // This is the one row that accepts any merge guard, because 4.3.2 stops it
    // with the new hard cap of 100 items per merge sequence rather than with
    // the budget. That cap is a second, independent answer to the same PoC; it
    // is not what the advisory describes, so it is not where the proof lives.
    // The CVE-specific proof is the budget accounting block above, which stays
    // inside every sequence-length cap and so can only pass on 4.3.2.
    assertRejected(
      'advisory PoC, N = 20000',
      emptyMergeDocument(20000, 20000),
      /abnormal merge sequence size|merge sequence length exceeded|merge keys exceeded maxTotalMergeKeys/
    );
  });

  it('stops a scaled repeat of the same shape below the merge-sequence cap', () => {
    assertBudgetExceeded(
      '100 sources x 10000 targets',
      emptyMergeDocument(100, 10000)
    );
  });

  it('is bounded without any caller-supplied option', () => {
    // This is the only form that matters for this repo. Both real entry points
    // call yaml.load(content) with no options at all, so the protection has to
    // come from the default.
    assertBudgetExceeded('no options passed', emptyMergeDocument(100, 1000));
  });
});

describe('consumer contract: the default budget is live at the real call sites', () => {
  it('@11ty/gray-matter parses front matter with no options and is bounded', () => {
    // @docusaurus/utils parses every MDX front matter block through
    // gray-matter, whose yaml engine is `yaml.load.bind(yaml)`. Feeding the
    // hostile document through that engine, rather than through load()
    // directly, is what proves the pin protects the build path.
    const grayMatterPath = require.resolve('@11ty/gray-matter');
    const grayMatter = require(grayMatterPath);
    const hostile = `---\n${emptyMergeDocument(100, 1000)}---\nbody\n`;

    assert.throws(
      () => grayMatter(hostile),
      /merge keys exceeded maxTotalMergeKeys/,
      'gray-matter accepted a merge document that should exhaust the default ' +
        'budget, so the build path is still unbounded'
    );

    // Negative control: the engine is reached and does parse ordinary front
    // matter, so the throw above cannot be an unrelated failure to load.
    const doc = grayMatter(
      '---\ntitle: Hello\nslug: hello\ntags: [a, b]\n---\nbody\n'
    );
    assert.equal(doc.data.title, 'Hello');
    assert.deepEqual(doc.data.tags, ['a', 'b']);
  });
});

describe('the budget must not be over-tight: merge still works', () => {
  it('folds a single aliased source', () => {
    const doc = assertParsed(
      'single source',
      'b: &B {a: 1, c: 3}\nm:\n  <<: *B\n  z: 9\n'
    );
    assert.deepEqual(doc.m, { a: 1, c: 3, z: 9 });
  });

  it('folds a merge sequence and keeps earlier-source precedence', () => {
    const doc = assertParsed(
      'two sources',
      'x: &X {k: fromX, onlyX: 1}\ny: &Y {k: fromY, onlyY: 2}\nm:\n  <<: [*X, *Y]\n'
    );
    assert.deepEqual(doc.m, { k: 'fromX', onlyX: 1, onlyY: 2 });
  });

  it('keeps an explicit key over a merged one', () => {
    const doc = assertParsed(
      'explicit wins',
      'x: &X {k: fromX}\nm:\n  k: explicit\n  <<: *X\n'
    );
    assert.equal(doc.m.k, 'explicit');
  });

  it('tolerates an empty source in a normal merge sequence', () => {
    const doc = assertParsed(
      'empty among real sources',
      'x: &X {a: 1}\nm:\n  <<: [*X, {}]\n'
    );
    assert.deepEqual(doc.m, { a: 1 });
  });

  it('parses a front-matter shaped document with no options', () => {
    assertParsed(
      'front matter shape',
      'title: Hello\nslug: hello\ndate: 2026-01-02\nauthors: [jul]\n' +
        'tags: [a, b]\nhide_table_of_contents: false\nsidebar_position: 3\n'
    );
  });

  it('parses a sidebar shaped document with no options', () => {
    const doc = assertParsed(
      'sidebars shape',
      'sidebars:\n  tutorialSidebar:\n    - type: category\n' +
        '      label: Docs\n      items:\n        - type: doc\n          id: intro\n'
    );
    assert.equal(doc.sidebars.tutorialSidebar[0].label, 'Docs');
  });
});

describe('repository corpus: every YAML this site builds from still parses', () => {
  // A pin that closed the advisory but broke front matter parsing would fail
  // the build job, and CI would show it. This makes the same fact visible from
  // `npm test` alone, and it names the file that regressed.

  const tracked = execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

  it('parses the front matter of every tracked Markdown file', () => {
    const files = tracked.filter(f => /\.(md|mdx)$/.test(f));
    let checked = 0;
    for (const file of files) {
      const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
      if (!match) continue;
      checked += 1;
      assertParsed(`${file} front matter`, match[1]);
    }
    assert.ok(
      checked > 0,
      'no tracked Markdown file had a front matter block, so this check ' +
        'tested nothing'
    );
  });

  it('parses every tracked YAML file', () => {
    const files = tracked.filter(f => /\.ya?ml$/.test(f));
    assert.ok(
      files.length > 0,
      'no tracked YAML files, so this check tested nothing'
    );
    for (const file of files) {
      assertParsed(file, fs.readFileSync(path.join(repoRoot, file), 'utf8'));
    }
  });
});
