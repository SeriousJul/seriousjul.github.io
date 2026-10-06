/**
 * Regression checks for the tinypool pin in package-lock.json.
 *
 * Covers the open tinypool advisory:
 *
 *   CVE-2026-104849  run(task, options)  options.filename read through
 *                    Object.prototype, patched in 2.1.2 by copying every
 *                    options object through a null-prototype object before
 *                    destructuring
 *
 * tinypool is a fork of piscina and inherited the same prototype-pollution
 * surface. In 1.1.1 the run path destructures the caller-provided options
 * object directly:
 *
 *   let { filename, name } = options;
 *   if (filename == null) filename = this.options.filename;
 *
 * When the caller passes an options object that has no own `filename`
 * property - the plain `pool.run(task, { signal })` shape that an HTTP
 * handler writes when all it wants is cancellation - the destructuring falls
 * through to Object.prototype. An attacker who has polluted
 * Object.prototype.filename with any upstream parser (lodash merge,
 * qs.parse, or similar) can then make the pool load and run an
 * attacker-controlled worker module, and the task - which in the advisory's
 * proof of concept is the raw request body - is handed to that worker for
 * exfiltration or modification. This is the tinypool counterpart of the
 * piscina root discovery GHSA-x9g3-xrwr-cwfg.
 *
 * 2.1.2 removes the fall-through: both the constructor and run() rebuild
 * the caller's object as a null-prototype copy before destructuring, so no
 * property lookup can ever reach Object.prototype.
 *
 * Two shapes of run() must be told apart, because only one is the bug.
 *
 *   pool.run(task)             safe on every version. The default options
 *                              object is built by tinypool itself and carries
 *                              its own `filename: null`, so the pollution is
 *                              never consulted.
 *   pool.run(task, { signal }) the advisory shape. The object is the
 *                              caller's, it has no own filename, and on
 *                              1.1.1 the polluted prototype value wins.
 *
 * The behavioural suite therefore runs the advisory shape under a live
 * Object.prototype.filename pollution and demands that the response come
 * from the worker the pool was constructed with, with the task data
 * intact. The fixture pair in tests/fixtures/tinypool/ reports which worker
 * ran, and the negative control (an explicit OWN filename option pointing
 * at the malicious fixture) proves the fixtures are distinguishable and
 * that a pool can still be told to run a different module on purpose, which
 * is documented API, not the vulnerability.
 *
 * Dependency security check, not a frontend test. It uses the node:test
 * runner built into Node, so it adds no dependency. It reads tinypool from
 * the project node_modules, so it exercises exactly the version the
 * committed lockfile resolves, and it names that version in every suite so
 * the artifact always says which build produced it.
 *
 * tinypool is transitive here, reached through `@docusaurus/core`, which
 * declares `^1.0.2`. That range does not admit 2.1.2, so the pin is a
 * cross-major npm override in package.json and the lockfile check below
 * treats an unsatisfied dependent range as expected, provided the override
 * exists and covers the pin. A future @docusaurus/core upgrade may drop
 * tinypool from the tree, so when the package is absent every suite
 * reports as skipped rather than failing with ERR_MODULE_NOT_FOUND and
 * breaking every pull request. Skipped, not passed: a run with nothing
 * installed proves nothing and says so.
 *
 * Run after `npm ci`, through npm or directly:
 *
 *     npm test
 *     node tests/tinypool-security.test.mjs
 *
 * Verified behaviour of this file against the two states that matter, each
 * measured by resolving that version in a project tree and re-running this
 * file from it. 7 leaf tests per run:
 *
 *   1.1.1   the replaced version    fails 3 of 7. The advisory-shape case
 *                                   fails because the task is answered by
 *                                   the attacker worker, and the two
 *                                   version-floor checks fail against the
 *                                   lockfile. The no-options and explicit
 *                                   filename cases pass, because they are
 *                                   not the vulnerability.
 *   2.1.2   first patched           passes 7 of 7
 *   absent  nothing to exercise     all 2 suites skipped, exit 0
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

// CVE-2026-104849 first patched. The floor the title of this change claims.
const MINIMUM_PIN = '2.1.2';

const legitimateWorker = path.join(
  here,
  'fixtures',
  'tinypool',
  'legitimate-worker.mjs'
);
const maliciousWorker = path.join(
  here,
  'fixtures',
  'tinypool',
  'malicious-worker.mjs'
);

let Tinypool = null;
let version = null;
let skipReason = null;

try {
  // tinypool is ESM-only, so it is loaded with import() rather than require.
  ({ default: Tinypool } = await import('tinypool'));
  // The package declares a `./package.json` export, so this resolves. Reading
  // the version off the install under test means every run says which build
  // it describes, with nothing to remember to set.
  version = require('tinypool/package.json').version;
} catch (error) {
  if (
    error?.code === 'MODULE_NOT_FOUND' ||
    error?.code === 'ERR_MODULE_NOT_FOUND'
  ) {
    skipReason =
      'tinypool is not installed in this tree, so there is nothing to ' +
      'check. It is transitive via @docusaurus/core.';
  } else {
    throw error;
  }
}

// One gate for every suite. When the package is absent this is `describe.skip`
// with a reason attached, so the run reports two skipped suites and says why,
// instead of passes that proved nothing or an ERR_MODULE_NOT_FOUND that
// breaks every pull request.
const suiteOptions = skipReason ? { skip: skipReason } : {};
const suite = (title, body) => describe(title, suiteOptions, body);
const SUITE_TITLE_SUFFIX = version ?? 'not installed';

// Set Object.prototype.filename for the duration of `body` and delete it on
// the way out, so no later test inherits the pollution. Object.prototype has
// no own filename, so the assertion below guards against a collision this
// file could not clean up.
function withPrototypeFilename(pollutedValue, body) {
  assert.ok(
    !Object.hasOwn(Object.prototype, 'filename'),
    'Object.prototype already carries an own filename, so this file cannot ' +
      'set and clean up the pollution it is testing'
  );
  Object.prototype.filename = pollutedValue;
  try {
    return body();
  } finally {
    delete Object.prototype.filename;
  }
}

// A pool pointed at the legitimate fixture, torn down afterwards whatever
// happened.
async function withLegitimatePool(body) {
  const pool = new Tinypool({
    filename: legitimateWorker,
    minThreads: 1,
    maxThreads: 2,
  });
  try {
    return await body(pool);
  } finally {
    await pool.destroy();
  }
}

// A task shaped like the advisory's: request-payload data that would be
// exfiltrated if the run were redirected.
const TASK = {
  email: 'user@example.com',
  password: 'hunter2',
  note: 'this body must never reach the attacker worker',
};

/** The three numeric parts of a version string. */
function semverParts(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text);
  assert.ok(match, `unrecognised tinypool version: ${text}`);
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
 * Only these forms appear in this tree, `^1.0.2` from @docusaurus/core.
 * Anything else is asserted rather than guessed, so an unexpected form
 * cannot quietly be read as satisfied.
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
 * The `tinypool` entries in the committed lockfile, with the parsed lock and
 * the root manifest.
 *
 * An npm lockfile holds one entry per install path, so a second key ending
 * in `/tinypool` would be a nested copy at its own version, and the pin this
 * file defends would not cover it.
 */
function lockfileEntries() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const entries = Object.entries(lock.packages).filter(([key]) =>
    /(^|\/)tinypool$/.test(key)
  );
  assert.ok(
    entries.length > 0,
    'package-lock.json has no tinypool entry at all, so this file is ' +
      'not looking at the manifest the advisory points at'
  );
  return [entries, lock, manifest];
}

suite(
  `lockfile pin: tinypool must sit outside < ${MINIMUM_PIN} (${SUITE_TITLE_SUFFIX})`,
  () => {
    it(`is at least ${MINIMUM_PIN}, first patched for CVE-2026-104849`, () => {
      assert.ok(
        isAtOrAbove(semverParts(version), semverParts(MINIMUM_PIN)),
        `tinypool ${version} is below ${MINIMUM_PIN}, so the run() options ` +
          `object is still read through Object.prototype and CVE-2026-104849 ` +
          `stays open.`
      );
    });

    it('resolves to exactly one flat copy, and it is the copy under test', () => {
      const [entries] = lockfileEntries();
      assert.equal(
        entries.length,
        1,
        `the lockfile holds ${entries.length} tinypool entries ` +
          `(${entries.map(([key]) => key).join(', ')}). A nested copy is a ` +
          `second resolved version that this pin does not cover, and that ` +
          `this file would never load.`
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
        `https://registry.npmjs.org/tinypool/-/tinypool-${version}.tgz`,
        `${key} resolves to an unexpected URL for ${version}`
      );
    });

    it('holds a cross-major override, because no dependent range admits the pin', () => {
      const [entries, lock, manifest] = lockfileEntries();
      const [, entry] = entries[0];
      const pin = entry.version;

      // Every declared range that still wants the vulnerable major.
      const dissatisfied = [];
      for (const [key, dep] of Object.entries(lock.packages)) {
        for (const field of [
          'dependencies',
          'optionalDependencies',
          'peerDependencies',
        ]) {
          const declared = dep[field]?.tinypool;
          if (declared && !satisfies(pin, declared)) {
            dissatisfied.push([key || '(root)', declared]);
          }
        }
      }
      // @docusaurus/core declares ^1.0.2, which cannot admit 2.1.2, so at
      // least one range must be dissatisfied. If none is, the pin would be
      // enforced by the ranges themselves and the override below is dead.
      assert.ok(
        dissatisfied.length > 0,
        'every dependent range satisfies the pin, so the cross-major ' +
          'override this file defends is not doing anything'
      );

      // A cross-major pin is enforced by an override alone: the override
      // must exist, and it must itself sit at or above the patched floor.
      const override = manifest.overrides?.tinypool;
      assert.ok(
        typeof override === 'string',
        `dependents ${dissatisfied
          .map(([key, range]) => `${key} wants ${range}`)
          .join(', ')} cannot admit ${pin} on their own, so an override is ` +
          `required, but package.json has no tinypool override`
      );
      assert.ok(
        isAtOrAbove(semverParts(override), semverParts(MINIMUM_PIN)),
        `the tinypool override pins ${override}, which is below ` +
          `${MINIMUM_PIN}, so a fresh install would resurrect a vulnerable ` +
          `copy`
      );
    });
  }
);

suite(
  `prototype pollution cannot redirect pool.run() to an attacker worker (${SUITE_TITLE_SUFFIX})`,
  () => {
    it('answers run(task, { signal }) from the constructed worker under a polluted Object.prototype.filename', async () => {
      // The advisory shape, exactly: the caller passes its own options
      // object that has no own filename, all it wants is a signal. On 1.1.1
      // the destructuring in runTask falls through to
      // Object.prototype.filename, and the task is answered by the
      // attacker's fixture instead.
      await withLegitimatePool(async pool => {
        const controller = new AbortController();
        const result = await withPrototypeFilename(
          maliciousWorker,
          () => pool.run(TASK, { signal: controller.signal })
        );
        assert.equal(
          result.by,
          'legitimate',
          `the task was answered by the ${JSON.stringify(result.by)} ` +
            `worker, so run() took filename from the polluted prototype ` +
            `and loaded the attacker module. The task carried ` +
            `${JSON.stringify(result)}`
        );
        assert.deepEqual(
          result.processed,
          TASK,
          'the legitimate worker did not receive the task data intact'
        );
      });
    });

    it('still answers run(task) under a polluted Object.prototype.filename', async () => {
      // Not affected on any version: the default options object is built by
      // tinypool itself and carries its own filename: null. This case
      // records that the unguarded call shape stays safe, so a "fix" that
      // broke the no-options path would be caught here.
      await withLegitimatePool(async pool => {
        const result = await withPrototypeFilename(maliciousWorker, () =>
          pool.run(TASK)
        );
        assert.equal(
          result.by,
          'legitimate',
          `run(task) with no options was redirected to the ` +
            `${JSON.stringify(result.by)} worker: ` +
            `${JSON.stringify(result)}`
        );
      });
    });

    it('answers run(task, { signal }) from the constructed worker with a clean prototype', async () => {
      // The unpolluted control for the advisory case: the same call, no
      // pollution, must also land on the legitimate worker. If this fails,
      // the fixtures or the pool construction are broken and the red case
      // above would be meaningless.
      await withLegitimatePool(async pool => {
        const controller = new AbortController();
        const result = await pool.run(TASK, { signal: controller.signal });
        assert.equal(
          result.by,
          'legitimate',
          `with no pollution at all the task was answered by the ` +
            `${JSON.stringify(result.by)} worker: ` +
            `${JSON.stringify(result)}`
        );
        assert.deepEqual(result.processed, TASK);
      });
    });

    it('lets an explicit own filename option pick the other fixture on purpose', async () => {
      // Negative control. A caller that owns its options object and names a
      // filename in it is the documented API, not the advisory. Running the
      // malicious fixture this way must reach the malicious fixture: if it
      // does not, the fixture pair cannot be told apart, and the advisory
      // case above could pass for the wrong reason.
      await withLegitimatePool(async pool => {
        const result = await pool.run(TASK, { filename: maliciousWorker });
        assert.equal(
          result.by,
          'attacker',
          `an explicit own filename option did not reach the named ` +
            `worker, so the fixture pair cannot be told apart: ` +
            `${JSON.stringify(result)}`
        );
        assert.deepEqual(
          result.stolen,
          TASK,
          'the explicitly named worker did not receive the task data intact'
        );
      });
    });
  }
);
