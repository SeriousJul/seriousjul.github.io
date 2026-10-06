/**
 * Regression checks for the postcss-selector-parser pin in
 * package-lock.json.
 *
 * Covers CVE-2026-104844 (GHSA-rj75-hqrm-r3gf, medium, CVSS 5.9).
 *
 *   `.` and `#` are not word delimiters in the tokenizer, so a flat
 *   selector such as `.a.a.a...` reaches `splitWord()` as a single word
 *   token carrying n class and id indexes. Three passes over that index
 *   array - `uniqs()`, the `indices.forEach` loop, and the
 *   Sass-interpolation filter - were each scanned linearly for every
 *   index, so the parse is O(n^2) in the number of indexes rather than
 *   in the input length. A 400 KB flat selector took ~34 s on a modern
 *   laptop, fully occupying a single thread, while a benign selector of
 *   identical byte size parses in tens of milliseconds. The nesting
 *   depth of such a selector is 0, so the `maxNestingDepth` guard added
 *   in 7.1.3 offers no protection.
 *
 *   7.1.6 rewrites the three passes with Set membership tests, making
 *   the parse linear in the index count. Upstream reports it as
 *   byte-identical on a differential corpus of 8413 selectors, so the
 *   correctness checks below pass on every version and the timing
 *   checks are the discriminator.
 *
 * Reachability is deployment dependent: this site parses trusted
 * sources at build time and in the dev server, so the practical
 * exposure is low. The lockfile finding stands regardless. Six cssnano
 * 6.x plugins (postcss-calc, postcss-discard-unused,
 * postcss-merge-rules, postcss-minify-selectors,
 * postcss-unique-selectors, stylehacks) declare `^6.0.11` or
 * `^6.0.16`, and the @csstools/postcss-* and postcss-modules-*
 * packages declare `^7.0.0`. The 6.x line ended at 6.1.4, which is
 * still inside the vulnerable range, so no range-based bump can take
 * every copy out of it. The pin is therefore a cross-major npm
 * override in package.json:
 *
 *     "overrides": { "postcss-selector-parser": "7.1.6" }
 *
 * and the lockfile check below treats an unsatisfied dependent range as
 * expected, provided the override exists and covers the pin.
 *
 * The one behaviour change between the 6.1.4 the cssnano plugins were
 * built against and 7.1.6 that could matter to them is the 7.0.0
 * iteration fix: `each` no longer skips a node inserted after the
 * current node during iteration - it yields the inserted node once
 * more. The cssnano plugins collect and then rewrite; they do not
 * insert while iterating, and `npm run build` exercises all of them
 * against this site's real CSS.
 *
 * Dependency security check, not a frontend test. It uses the node:test
 * runner built into Node, so it adds no dependency. It reads
 * postcss-selector-parser from the project node_modules, so it
 * exercises exactly the version the committed lockfile resolves, and
 * it names that version in every suite so the artifact always says
 * which build produced it.
 *
 * Run after `npm ci`, through npm or directly:
 *
 *     npm test
 *     node tests/postcss-selector-parser-security.test.mjs
 *
 * Verified behaviour of this file, each state measured by resolving
 * that version in a project tree and re-running this file from it:
 *
 *   7.1.4   highest released vulnerable  the timing suite fails. The
 *           400 KB flat selector takes ~16 s, about 61x the time the
 *           eighth-size parse takes
 *   6.1.4   the 6.x line, also vulnerable  the same quadratic
 *           behaviour, ~16 s for the 400 KB flat selector
 *   7.1.6   first patched           every check passes. The 400 KB
 *           flat selector takes tens of milliseconds
 *   absent  nothing to exercise     both suites skipped, exit 0
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

// The first patched version, the floor both the lockfile and the
// override must sit at or above.
const MINIMUM_VERSION = '7.1.6';

// The advisory's reference payload: a 400 KB flat selector, 200000
// class indexes at two bytes each.
const LARGE_INDEXES = 200000;
// One eighth of the large parse. A quadratic cost grows by 64x going
// from small to large, a linear cost by 8x.
const SMALL_INDEXES = 25000;
// Measured against the patched 7.1.6: tens of milliseconds for the
// large parse on a laptop, so the bound sits orders of magnitude above
// patched and below the ~16 s the vulnerable versions need on the same
// machine.
const LARGE_PARSE_BUDGET_MS = 5000;
// Splits the quadratic 64x from the linear ~8x with a 4x margin each
// way.
const MAX_RATIO_TO_SMALL_PARSE = 32;

let parser = null;
let version = null;
let skipReason = null;

try {
  // postcss-selector-parser is CommonJS and this tree resolves exactly
  // one copy, flat at the root, so a plain require from the tests
  // directory loads the pinned version.
  parser = require('postcss-selector-parser');
  version = require('postcss-selector-parser/package.json').version;
} catch (error) {
  if (
    error?.code === 'MODULE_NOT_FOUND' ||
    error?.code === 'ERR_MODULE_NOT_FOUND'
  ) {
    skipReason =
      'postcss-selector-parser is not installed in this tree, so there ' +
      'is nothing to check. It is transitive via cssnano and the ' +
      '@csstools/postcss-* plugins.';
  } else {
    throw error;
  }
}

// One gate for every suite. When the package is absent this is
// `describe.skip` with a reason attached, so the run reports skipped
// suites and says why, instead of failing with ERR_MODULE_NOT_FOUND
// and breaking every pull request.
const suiteOptions = skipReason ? { skip: skipReason } : {};
const suite = (title, body) => describe(title, suiteOptions, body);
const SUITE_TITLE_SUFFIX = version ?? 'not installed';

/** The three numeric parts of a version string. */
function semverParts(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text);
  assert.ok(match, `unrecognised postcss-selector-parser version: ${text}`);
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

/**
 * True when `candidate` satisfies a `^x.y.z`, `>=x.y.z`, or exact `x.y.z`
 * range.
 *
 * Only these forms appear in this tree: `^7.0.0` from the @csstools and
 * postcss-modules packages, `^6.0.11` from postcss-calc, and `^6.0.16`
 * from the cssnano 6.x plugins. Anything else is asserted rather than
 * guessed, so an unexpected form cannot quietly be read as satisfied.
 */
function satisfies(candidate, range) {
  const wanted = /^(\^|>=)?(\d+)\.(\d+)\.(\d+)$/.exec(range);
  assert.ok(
    wanted,
    `unrecognised range form, so this check cannot judge it: ${range}`
  );
  const [maj, min, pat] = semverParts(candidate);
  const lower = [Number(wanted[2]), Number(wanted[3]), Number(wanted[4])];
  if (!isAtOrAbove([maj, min, pat], lower)) return false;
  // A caret range on a non-zero major allows the major to move within the
  // same major only.
  if (wanted[1] === '^') return maj === lower[0];
  return true;
}

/**
 * The `postcss-selector-parser` entries in the committed lockfile, with
 * the parsed lock and the root manifest.
 *
 * An npm lockfile holds one entry per install path, so a second key
 * ending in `/postcss-selector-parser` would be a nested copy at its
 * own version, and the pin this file defends would not cover it.
 */
function lockfileEntries() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const entries = Object.entries(lock.packages).filter(([key]) =>
    /(^|\/)postcss-selector-parser$/.test(key)
  );
  assert.ok(
    entries.length > 0,
    'package-lock.json has no postcss-selector-parser entry at all, so ' +
      'this file is not looking at the manifest the advisory points at'
  );
  return [entries, lock, manifest];
}

/** The advisory shape: one word token, n class indexes, no nesting. */
function flatClassSelector(indexes) {
  return '.a'.repeat(indexes);
}

/**
 * Parse `selector` synchronously and time it in milliseconds.
 *
 * `processSync` returns the stringified result; `astSync` returns the
 * Root and is the call the cssnano plugins and the advisory's own
 * measurements go through.
 */
function parseTimed(selector) {
  const start = process.hrtime.bigint();
  const root = parser().astSync(selector);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return { root, ms };
}

suite(
  `lockfile pin: postcss-selector-parser must sit outside < ${MINIMUM_VERSION} (${SUITE_TITLE_SUFFIX})`,
  () => {
    it(`is at least ${MINIMUM_VERSION}, first patched for CVE-2026-104844`, () => {
      assert.ok(
        isAtOrAbove(semverParts(version), semverParts(MINIMUM_VERSION)),
        `postcss-selector-parser ${version} is below ${MINIMUM_VERSION}, ` +
          `so the three index-array passes in splitWord() are still ` +
          `quadratic and CVE-2026-104844 stays open.`
      );
    });

    it('resolves to exactly one flat copy, and it is the copy under test', () => {
      const [entries] = lockfileEntries();
      assert.equal(
        entries.length,
        1,
        `the lockfile holds ${entries.length} postcss-selector-parser ` +
          `entries (${entries.map(([key]) => key).join(', ')}). A nested ` +
          `copy is a second resolved version that this pin does not ` +
          `cover, and that this file would never load.`
      );
      const [key, entry] = entries[0];
      assert.equal(
        entry.version,
        version,
        `${key} says ${entry.version} but node_modules holds ${version}, ` +
          `so the version this file proves safe is not the version a ` +
          `fresh CI \`npm ci\` will install.`
      );
      assert.equal(
        entry.resolved,
        `https://registry.npmjs.org/postcss-selector-parser/-/postcss-selector-parser-${version}.tgz`,
        `${key} resolves to an unexpected URL for ${version}`
      );
    });

    it('holds a cross-major override, because no dependent range admits the pin', () => {
      const [entries, lock, manifest] = lockfileEntries();
      const [, entry] = entries[0];
      const pin = entry.version;

      // Every declared range that still wants a major the pin does not
      // satisfy. The cssnano 6.x plugins declare ^6.0.11 and ^6.0.16,
      // which cannot admit 7.1.6, so at least one range must be
      // dissatisfied. If none is, the pin would be enforced by the
      // ranges themselves and the override below is dead.
      const dissatisfied = [];
      for (const [key, dep] of Object.entries(lock.packages)) {
        for (const field of [
          'dependencies',
          'optionalDependencies',
          'peerDependencies',
        ]) {
          const declared = dep[field]?.['postcss-selector-parser'];
          if (declared && !satisfies(pin, declared)) {
            dissatisfied.push([key || '(root)', declared]);
          }
        }
      }
      assert.ok(
        dissatisfied.length > 0,
        'every dependent range satisfies the pin, so the cross-major ' +
          'override this file defends is not doing anything'
      );

      // A cross-major pin is enforced by an override alone: the override
      // must exist, and it must itself sit at or above the patched floor.
      const override = manifest.overrides?.['postcss-selector-parser'];
      assert.ok(
        typeof override === 'string',
        `dependents ${dissatisfied
          .map(([key, range]) => `${key} wants ${range}`)
          .join(', ')} cannot admit ${pin} on their own, so an override ` +
          `is required, but package.json has no postcss-selector-parser ` +
          `override`
      );
      assert.ok(
        isAtOrAbove(semverParts(override), semverParts(MINIMUM_VERSION)),
        `the postcss-selector-parser override pins ${override}, which is ` +
          `below ${MINIMUM_VERSION}, so a fresh install would resurrect a ` +
          `vulnerable copy`
      );
    });
  }
);

suite(
  `flat selector parsing is linear in the index count (${SUITE_TITLE_SUFFIX})`,
  () => {
    it('parses a flat selector into one compound with one node per index', () => {
      const root = parser().astSync('.a.a#b');
      assert.equal(
        root.length,
        1,
        `one flat selector must parse to one selector, got ${root.length}`
      );
      const kinds = root.first.nodes.map(node => node.type);
      assert.deepEqual(
        kinds,
        ['class', 'class', 'id'],
        `the flat selector .a.a#b must parse to two class nodes and one ` +
          `id node, got ${JSON.stringify(kinds)}`
      );

      // The large parse must build the full tree, not bail out early:
      // if it did, the timing checks below would pass without having
      // parsed anything.
      const large = flatClassSelector(1000);
      const largeRoot = parser().astSync(large);
      assert.equal(largeRoot.length, 1);
      const classes = largeRoot.first.nodes.filter(
        node => node.type === 'class'
      );
      assert.equal(
        classes.length,
        1000,
        `the 1000-index flat selector must parse to 1000 class nodes, ` +
          `got ${classes.length}`
      );
    });

    it(`parses the 400 KB advisory payload (${LARGE_INDEXES} indexes) in under ${LARGE_PARSE_BUDGET_MS} ms`, () => {
      const { root, ms } = parseTimed(flatClassSelector(LARGE_INDEXES));
      assert.equal(
        root.length,
        1,
        'the large flat selector must stay one selector'
      );
      const classes = root.first.nodes.filter(node => node.type === 'class');
      assert.equal(
        classes.length,
        LARGE_INDEXES,
        `the large parse must keep every one of its ${LARGE_INDEXES} ` +
          `class nodes, got ${classes.length}`
      );
      assert.ok(
        ms < LARGE_PARSE_BUDGET_MS,
        `the ${LARGE_INDEXES}-index flat selector took ${ms.toFixed(1)} ms, ` +
          `over the ${LARGE_PARSE_BUDGET_MS} ms budget. The patched parse ` +
          `is linear and takes tens of milliseconds; ~16 s is what the ` +
          `vulnerable versions need, so the O(n^2) index passes are back.`
      );
    });

    it('grows linearly: eight times the indexes take far less than sixty-four times the time', () => {
      // Warm the JIT and the module once, untimed, so neither measured
      // parse pays a one-off start-up cost.
      parser().astSync(flatClassSelector(SMALL_INDEXES));

      const small = parseTimed(flatClassSelector(SMALL_INDEXES));
      const large = parseTimed(flatClassSelector(LARGE_INDEXES));

      assert.ok(
        large.ms < MAX_RATIO_TO_SMALL_PARSE * small.ms,
        `${LARGE_INDEXES} indexes took ${large.ms.toFixed(1)} ms, ` +
          `${(large.ms / small.ms).toFixed(1)}x the ` +
          `${small.ms.toFixed(1)} ms that one eighth of them took. A ` +
          `linear parse grows about 8x at this ratio; 64x is the ` +
          `quadratic signature of the three index-array passes.`
      );
    });
  }
);
