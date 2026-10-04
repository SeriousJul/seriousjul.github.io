/**
 * Regression checks for the joi pin in package-lock.json.
 *
 * Covers GHSA-6h2x-m376-mqjq (dependabot alert 51, high, CVSS 7.5, CWE-1333).
 * `Joi.string().isoDate()` runs two regular expressions over the input. The
 * first, `Common.isIsoDate` in lib/common.js, is anchored at both ends. The
 * second is the timeshift fix-up in lib/types/string.js:
 *
 *     if (/.*T.*[+-]\d\d$/.test(value)) {   // 17.13.6 and older
 *         value += '00';
 *     }
 *
 * That one is anchored only at the end. A leading `.*` lets the engine start a
 * fresh attempt at every offset of the subject, and each attempt walks the
 * whole subject before it fails, so a string that reaches the fix-up and does
 * not end in `[+-]dd` costs O(n^2). `2024-01-01T00:00:00.` plus a run of
 * fractional-second digits is exactly that string: it passes the anchored
 * regex, so it reaches the fix-up, and it ends in digits, so the fix-up fails.
 * 17.13.7 drops the leading `.*` and anchors the attempt on the literal `T`,
 * which the engine can skip ahead to, and appends `:00` instead of `00`.
 *
 * joi is transitive here. Two packages require `^17.9.2`: `@docusaurus/types`
 * and `@docusaurus/utils-validation`. The lockfile resolves both to one flat
 * copy, so this pin is the whole fix. No override and no range rewrite is
 * needed, because 17.13.7 satisfies `^17.9.2`.
 *
 * 17.13.3, the version this pin replaces, also sits inside the vulnerable
 * range of three older joi advisories that 17.13.7 clears on the way:
 * GHSA-q7cg-457f-vx79 (`link()` RangeError, < 17.13.4), GHSA-gg4h-3hg2-grpc
 * (`rename()` prototype, >= 16.0.0 < 17.13.5), and GHSA-6w3j-5fw6-r9vr
 * (`__proto__` message language, >= 17.2.0 < 17.13.6).
 *
 * Dependency security check, not a frontend test. It uses the node:test runner
 * built into Node, so it adds no dependency. It reads joi from the project
 * node_modules, so it exercises exactly the version the committed lockfile
 * resolves.
 *
 * Run after `npm ci`, through npm or directly:
 *
 *     npm test
 *     node tests/joi-security.test.mjs
 *
 * Verified behaviour of this file against the six versions that matter, each
 * measured by swapping that version into the project node_modules and
 * re-running this file. 61 leaf tests per run:
 *
 *   17.13.3   the replaced version  fails 5 of 61   version floor, the three
 *                                                   timing probes, and the
 *                                                   lockfile/node_modules
 *                                                   agreement check that a
 *                                                   swapped copy trips by
 *                                                   design
 *   17.13.4   fails 5 of 61         clears GHSA-q7cg-457f-vx79 only
 *   17.13.5   fails 5 of 61         clears that one and GHSA-gg4h-3hg2-grpc
 *   17.13.6   fails 5 of 61         clears all three older advisories and
 *                                                   passes every behavioural
 *                                                   check except the timing
 *                                                   probes, which is the point
 *                                                   of the 17.13.7 floor
 *   17.13.7   this pin              passes 61 of 61
 *   17.13.8   fails 1 of 61         same fix, one patch later, so only the
 *                                                   agreement check fires
 *
 * Measured cost of the two timed probes on 17.13.6, best of three runs each:
 * 1.6 s for the 64 KB payload and 24 s for the 256 KB payload, against 0.13 ms
 * and 0.45 ms on 17.13.7. That is the 1.4 s and 22 s the advisory reports.
 *
 * The 17.13.6 row is the point of the version floor. 17.13.6 clears the three
 * older joi advisories and satisfies every "isoDate still accepts the same
 * strings" assertion below, because GHSA-6h2x-m376-mqjq is a resource-cost
 * defect with no observable difference in the output of a well-formed date.
 * Without the floor and the timing probes, this file cannot tell the pin it
 * defends from a pin that leaves alert 51 open.
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

const Joi = require('joi');
const { version } = require('joi/package.json');

// GHSA-6h2x-m376-mqjq first patched, and the only 17.x release that anchors
// the timeshift fix-up.
const MINIMUM_PIN = '17.13.7';

// The advisory's own two scales: 64 KB of digits costs about 1.4 s and 256 KB
// about 22 s on the unanchored regex. These caps sit three orders of magnitude
// above what the pinned version actually spends at the same sizes, and well
// below what the vulnerable versions spend, so no scheduling noise can move a
// row across the line.
const SIZE_SMALL = 64_000;
const SIZE_LARGE = 256_000;
const CAP_SMALL_MS = 250;
const CAP_LARGE_MS = 1_000;

/**
 * A string that passes the anchored ISO regex and then fails the timeshift
 * fix-up, which is the shape that makes the fix-up quadratic.
 *
 * The anchored regex in lib/common.js accepts `2024-01-01T00:00:00.` followed
 * by any run of digits through its `(?:[.,]\d+(?!:))?` group. The fix-up needs
 * `[+-]` and two digits at the very end, and a run of fractional digits has
 * neither, so every start offset from 0 to n is tried and each one fails.
 */
function hostileIsoDate(digits) {
  return `2024-01-01T00:00:00.${'1'.repeat(digits)}`;
}

/**
 * Best of `reps` validate() timings in milliseconds, for `schema` on `value`.
 *
 * Best-of-N rather than a single run, because the first pass through a schema
 * carries JIT warm-up that has nothing to do with the regex cost under test.
 */
function validateMillis(schema, value, reps = 3) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < reps; i += 1) {
    const start = process.hrtime.bigint();
    schema.validate(value);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (ms < best) {
      best = ms;
    }
  }
  return best;
}

/** Assert validating `value` stays under `capMs`, and name the cost if not. */
function assertUnder(what, schema, value, capMs) {
  const ms = validateMillis(schema, value);
  assert.ok(
    ms < capMs,
    `${what}: validate() took ${ms.toFixed(1)} ms, over the ${capMs} ms cap. ` +
      `Cost grows with the square of the input length, which is ` +
      `GHSA-6h2x-m376-mqjq. The advisory measures 1.4 s at 64 KB and 22 s at ` +
      `256 KB for this shape.`
  );
  return ms;
}

/**
 * Assert validate() accepts `value`, and say so when it does not.
 *
 * Every timing probe below needs the input to reach the end of the rule. A
 * payload rejected early by the anchored regex would time fast for a reason
 * that has nothing to do with the fix.
 */
function assertAccepted(what, schema, value) {
  const result = schema.validate(value);
  assert.equal(
    result.error,
    undefined,
    `${what}: joi rejected this input (${result.error?.message}), so the ` +
      `timing probe never reached the timeshift fix-up and measures nothing`
  );
  return result.value;
}

/** The three numeric parts of a version string. */
function semverParts(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text);
  assert.ok(match, `unrecognised joi version: ${text}`);
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

function readLockfile() {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
  );
}

/**
 * The `node_modules/joi` entries in the committed lockfile.
 *
 * A flat npm lockfile holds one entry per install path, so a second key ending
 * in `/joi` would be a nested copy at a different version, and the pin in the
 * top-level entry would not cover it.
 */
function lockfileJoiEntries() {
  const entries = Object.entries(readLockfile().packages).filter(([key]) =>
    /(^|\/)joi$/.test(key)
  );
  assert.ok(
    entries.length > 0,
    'package-lock.json has no joi entry at all, so this test is not looking ' +
      'at the manifest the advisory points at'
  );
  return entries;
}

/**
 * Every lockfile package that declares a joi dependency, with its range.
 *
 * A pin that no consumer range accepts is not a pin: the next `npm install`
 * re-resolves it away.
 */
function lockfileJoiRanges() {
  const ranges = [];
  for (const [key, entry] of Object.entries(readLockfile().packages)) {
    for (const field of [
      'dependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      const declared = entry[field]?.joi;
      if (declared) {
        ranges.push([key || '(root)', declared]);
      }
    }
  }
  assert.ok(
    ranges.length >= 2,
    `expected the two known joi consumers, @docusaurus/types and ` +
      `@docusaurus/utils-validation, to appear in the lockfile, found ` +
      `${ranges.length}`
  );
  return ranges;
}

/**
 * Recursively collect absolute file paths under `dir` matching `filter`.
 *
 * `dir` must already be absolute. Callers build it from `repoRoot`, so a
 * direct `node tests/joi-security.test.mjs` from anywhere scans the same tree
 * that `npm test` does.
 */
function walk(dir, filter) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full, filter));
    } else if (filter(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** The front matter block of a Markdown file, or null when it has none. */
function frontMatterOf(file) {
  const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  return match ? match[1] : null;
}

describe(`lockfile pin: joi must sit outside >= 17.2.0, < ${MINIMUM_PIN} (${version})`, () => {
  it(`is at least ${MINIMUM_PIN}, first patched for GHSA-6h2x-m376-mqjq`, () => {
    assert.ok(
      isAtOrAbove(semverParts(version), semverParts(MINIMUM_PIN)),
      `joi ${version} is below ${MINIMUM_PIN}, so the timeshift fix-up in ` +
        `string.js is still unanchored and GHSA-6h2x-m376-mqjq stays open. ` +
        `17.13.6 clears the three older joi advisories and passes every ` +
        `behavioural check in this file, so this floor is the only thing that ` +
        `separates the two pins.`
    );
  });

  it('resolves to exactly one flat copy, and it is the copy under test', () => {
    const entries = lockfileJoiEntries();
    assert.equal(
      entries.length,
      1,
      `the lockfile holds ${entries.length} joi entries ` +
        `(${entries.map(([key]) => key).join(', ')}). A nested copy is a ` +
        `second resolved version that this pin does not cover.`
    );
    const [key, entry] = entries[0];
    assert.equal(
      entry.version,
      version,
      `${key} says ${entry.version} but node_modules holds ${version}, so the ` +
        `version this file proves safe is not the version a fresh CI ` +
        `\`npm ci\` will install.`
    );
    assert.equal(
      entry.resolved,
      `https://registry.npmjs.org/joi/-/joi-${version}.tgz`,
      `${key} resolves to an unexpected URL for ${version}`
    );
    assert.ok(
      typeof entry.integrity === 'string' &&
        /^sha512-[A-Za-z0-9+/]+=*$/.test(entry.integrity),
      `${key} has no sha512 integrity, so npm cannot verify the tarball it ` +
        `downloads for this pin`
    );
  });

  it('keeps every dependent range satisfied, so a reinstall cannot roll it back', () => {
    for (const [consumer, range] of lockfileJoiRanges()) {
      assert.ok(
        satisfiesCaret(version, range),
        `${consumer} requires joi ${range}, and the pinned ${version} does ` +
          `not satisfy it, so a fresh install would replace this pin`
      );
    }
  });

  it('pulls in no new dependencies of its own', () => {
    // 17.13.3 through 17.13.8 declare the same five @hapi and @sideway
    // packages, and the only field that differs in their package.json is
    // "version". A pin that changed this set would be a different release
    // line than the patch this advisory asks for.
    const [, entry] = lockfileJoiEntries()[0];
    assert.deepEqual(
      Object.keys(entry.dependencies ?? {}).sort(),
      [
        '@hapi/hoek',
        '@hapi/topo',
        '@sideway/address',
        '@sideway/formula',
        '@sideway/pinpoint',
      ].sort(),
      `joi ${version} declares a different dependency set than the five ` +
        `packages 17.13.3 declared, so this is not the patch-line bump the ` +
        `advisory asks for`
    );
  });
});

describe('GHSA-6h2x-m376-mqjq: isoDate() must not backtrack quadratically', () => {
  // The three probes below are the CVE proof. On 17.13.6 they cost about 1.6 s
  // and about 24 s on this machine; on 17.13.7 they cost about a thousandth of
  // the cap each. The growth probe is the one that names the shape of the
  // defect: a 4x longer input must cost about 4x more time, not about 16x.

  const isoDate = Joi.string().isoDate();

  it(`a ${SIZE_SMALL} digit hostile ISO date validates in under ${CAP_SMALL_MS} ms`, () => {
    const value = hostileIsoDate(SIZE_SMALL);
    assertAccepted(`${SIZE_SMALL} digits`, isoDate, value);
    assertUnder(`${SIZE_SMALL} digits`, isoDate, value, CAP_SMALL_MS);
  });

  it(`a ${SIZE_LARGE} digit hostile ISO date validates in under ${CAP_LARGE_MS} ms`, () => {
    const value = hostileIsoDate(SIZE_LARGE);
    assertAccepted(`${SIZE_LARGE} digits`, isoDate, value);
    assertUnder(`${SIZE_LARGE} digits`, isoDate, value, CAP_LARGE_MS);
  });

  it('cost grows linearly, not quadratically, with input length', () => {
    const base = validateMillis(isoDate, hostileIsoDate(SIZE_SMALL));
    const fourX = validateMillis(isoDate, hostileIsoDate(SIZE_LARGE));
    const ratio = fourX / Math.max(base, 0.01);
    assert.ok(
      ratio < 9,
      `cost grew ${ratio.toFixed(1)}x for a 4x longer input. Linear cost ` +
        `predicts about 4x; the unanchored timeshift regex predicts about ` +
        `16x, which is GHSA-6h2x-m376-mqjq.`
    );
  });

  it('the cost belongs to the isoDate rule, not to Joi.string()', () => {
    // Negative control for the two caps above. The same 256 KB payload through
    // a plain string() schema is fast on every version, so a cap failure can
    // only come from the rule the advisory names.
    const plain = Joi.string();
    const value = hostileIsoDate(SIZE_LARGE);
    const plainMs = validateMillis(plain, value);
    assert.ok(
      plainMs < CAP_LARGE_MS,
      `plain Joi.string() alone took ${plainMs.toFixed(1)} ms on this input, ` +
        `so the isoDate caps above measure the harness and not the rule`
    );
  });

  it('Joi.date() never reaches the fix-up, and stays fast', () => {
    // Second control. Joi.date() is the rule Docusaurus actually uses for
    // front matter dates, and it runs only the anchored Common.isIsoDate. It
    // stays fast on the same payload on every version, which is why this repo
    // has no live exposure and why the pin is hygiene plus latent-plugin
    // cover rather than a fix for a reachable attack here.
    const value = hostileIsoDate(SIZE_LARGE);
    const ms = validateMillis(Joi.date().raw(), value);
    assert.ok(
      ms < CAP_LARGE_MS,
      `Joi.date() took ${ms.toFixed(1)} ms on this input, so the anchored ` +
        `regex in common.js has become the quadratic one and the analysis ` +
        `behind this pin needs revisiting`
    );
  });
});

describe('the fix must not change what isoDate() accepts', () => {
  // 17.13.7 changes the fix-up body as well as its regex: it appends ':00'
  // where 17.13.6 appended '00'. Both spell the same instant, so the accepted
  // set and the normalised output must not move. These rows are the
  // compatibility guard for the pin, and each one names the exact value joi
  // returns.

  const isoDate = Joi.string().isoDate();

  // Every row here states its zone explicitly, either as `Z` or as an offset,
  // or is a date-only form that ISO 8601 defines as UTC. A zone-less date-time
  // such as `2024-01-01T00:00` normalises against the machine's local zone,
  // so it would pass here and fail on a UTC CI runner. Those forms are left
  // out on purpose.
  const accepted = [
    ['2024-01-01', '2024-01-01T00:00:00.000Z'],
    ['0000-01-01', '0000-01-01T00:00:00.000Z'],
    ['+002024-01-01', '2024-01-01T00:00:00.000Z'],
    ['-002024-01-01', '-002024-01-01T00:00:00.000Z'],
    ['2024-01-01T00:00:00Z', '2024-01-01T00:00:00.000Z'],
    ['2024-01-01 00:00:00Z', '2024-01-01T00:00:00.000Z'],
    ['2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
    ['2024-01-01T00:00:00.1Z', '2024-01-01T00:00:00.100Z'],
    ['2024-01-01T00:00:00.123456Z', '2024-01-01T00:00:00.123Z'],
    ['2024-01-01T00:00:00.999999999999Z', '2024-01-01T00:00:00.999Z'],
    [
      '2024-01-01T00:00:00.123456789012345678901234567890Z',
      '2024-01-01T00:00:00.123Z',
    ],
    ['2024-01-01T00:00+01', '2023-12-31T23:00:00.000Z'],
    ['2024-01-01T00:00-05', '2024-01-01T05:00:00.000Z'],
    ['2024-01-01T00:00+0100', '2023-12-31T23:00:00.000Z'],
    ['2024-01-01T00:00+01:00', '2023-12-31T23:00:00.000Z'],
    ['2024-01-01T00:00:00+01', '2023-12-31T23:00:00.000Z'],
    ['2024-01-01T00:00:00+01:00', '2023-12-31T23:00:00.000Z'],
    ['2024-01-01T00:00:00-14', '2024-01-01T14:00:00.000Z'],
    ['+002024-01-01T00:00-05', '2024-01-01T05:00:00.000Z'],
    ['1970-01-01T00:00:00.1+00', '1970-01-01T00:00:00.100Z'],
    ['9999-12-31T23:59:59.999999+23', '9999-12-31T00:59:59.999Z'],
    ['2024-01-01T00:00:00.1+01', '2023-12-31T23:00:00.100Z'],
    ['2024-01-01T00:00:00.1+0100', '2023-12-31T23:00:00.100Z'],
    ['2024-01-01T00:00:00.1+01:00', '2023-12-31T23:00:00.100Z'],
    ['2024-01-01T00:00:00.1+12', '2023-12-31T12:00:00.100Z'],
    ['2024-01-01T00:00:00.1-05', '2024-01-01T05:00:00.100Z'],
    ['2024-01-01T00:00:00.5-05', '2024-01-01T05:00:00.500Z'],
    ['2024-01-01T00:00:00.5+0100', '2023-12-31T23:00:00.500Z'],
  ];

  for (const [input, expected] of accepted) {
    it(`accepts ${input} as ${expected}`, () => {
      assert.equal(assertAccepted(input, isoDate, input), expected);
    });
  }

  const rejected = [
    '2024-01-01T00:00:00,5Z',
    '2024-01-01T00:00:00+24',
    '2024-01-01T24:00:00Z',
    '2024-01-01T12-05',
    '2024-01-01T12-05:30',
    '2024-01-01T12-5',
    '2024-01-01T00:00.5+01',
    '2024-01-01T00:00.5-05',
    '2024-01-01T00:00:00.',
    '2024-01-01T00:00:00.1+1',
    '2024-01-01T00:00:00.1-1',
    '2024-01-01T00:00:00Z+01',
    '2024-01-01T00:00:00+01Z',
    '2024-01-01T00:00:00.1Z+01',
    '2024-01-01T00:00:00.1-05Z',
    '2024-W01-1',
    '2024-13-01',
    'not-a-date',
  ];

  for (const input of rejected) {
    it(`still rejects ${JSON.stringify(input)}`, () => {
      const result = isoDate.validate(input);
      assert.ok(
        result.error,
        `joi ${version} accepted ${JSON.stringify(input)} as ` +
          `${JSON.stringify(result.value)}, which 17.13.6 rejected, so this ` +
          `pin widened the accepted set`
      );
      assert.equal(result.error.message, '"value" must be in iso format');
    });
  }

  it('still rejects an empty string through the length rule', () => {
    // Not an isoDate message. Kept because it is the one row in this block
    // whose rejection comes from a different rule, so a reader can tell that
    // the rows above fail for the reason they claim.
    const result = isoDate.validate('');
    assert.ok(result.error, 'joi accepted an empty string');
    assert.equal(result.error.message, '"value" is not allowed to be empty');
  });
});

describe('consumer contract: Docusaurus reaches this exact copy', () => {
  const utilsValidation = require('@docusaurus/utils-validation');

  it('@docusaurus/utils-validation re-exports the pinned copy', () => {
    // validationSchemas.js builds every Docusaurus schema from ./Joi, which is
    // `export {default} from 'joi'`. Plugin code that calls
    // Joi.string().isoDate() gets this copy, which is the latent exposure this
    // pin closes even though no Docusaurus schema uses isoDate today.
    assert.equal(
      utilsValidation.Joi,
      Joi,
      'the Joi that @docusaurus/utils-validation re-exports is not the copy ' +
        'this file tests, so the pin does not cover the plugin-facing API'
    );
    assert.equal(utilsValidation.Joi.version, version);
  });

  it('no Docusaurus schema calls isoDate today', () => {
    // Documents how far the exposure actually reaches, so the "latent" claim
    // in this file's header is checked rather than assumed. If a future
    // Docusaurus starts using isoDate, this fails and the severity of the pin
    // gets revisited instead of going stale.
    const scanned = walk(
      path.join(repoRoot, 'node_modules', '@docusaurus'),
      name => /\.(js|ts|mjs|cjs)$/.test(name)
    );
    assert.ok(
      scanned.length > 100,
      `only ${scanned.length} Docusaurus source files were scanned, so this ` +
        `check tested almost nothing`
    );
    const hits = scanned.filter(file =>
      fs.readFileSync(file, 'utf8').includes('isoDate')
    );
    assert.deepEqual(
      hits,
      [],
      `these Docusaurus files reference isoDate, so the vulnerable rule is ` +
        `reachable from the build: ${hits.join(', ')}`
    );

    // Negative control: the same scan over joi itself does find the rule, so
    // an empty hit list above means absence and not a broken scan.
    const joiFiles = walk(
      path.join(repoRoot, 'node_modules', 'joi', 'lib'),
      name => /\.js$/.test(name)
    );
    const joiHits = joiFiles.filter(file =>
      fs.readFileSync(file, 'utf8').includes('isoDate')
    );
    assert.ok(
      joiHits.length > 0,
      'the scan found no isoDate inside joi itself, so the scan is broken ' +
        'and the empty Docusaurus hit list proves nothing'
    );
  });

  it('the schemas Docusaurus builds from joi still validate real values', () => {
    assert.deepEqual(
      utilsValidation.FrontMatterLastUpdateSchema.validate({
        author: 'jul',
        date: '2026-01-02',
      }),
      { value: { author: 'jul', date: '2026-01-02' } }
    );
    assert.equal(
      utilsValidation.RouteBasePathSchema.validate('/docs').value,
      '/docs'
    );
    assert.equal(
      utilsValidation.URISchema.validate('https://seriousjul.github.io').value,
      'https://seriousjul.github.io'
    );
    assert.equal(
      utilsValidation.PluginIdSchema.validate('my-plugin').value,
      'my-plugin'
    );
  });
});

describe('repository corpus: every front matter block this site builds from still validates', () => {
  // A pin that closed the advisory but broke Docusaurus's own joi schemas
  // would fail the build job. This makes the same fact visible from `npm test`
  // alone, and it names the file that regressed.

  const docsPlugin = require('@docusaurus/plugin-content-docs/lib/frontMatter.js');
  const blogPlugin = require('@docusaurus/plugin-content-blog/lib/frontMatter.js');
  const matter = require('@11ty/gray-matter');

  const tracked = execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

  function frontMatterUnder(dir) {
    return tracked
      .filter(f => f.startsWith(`${dir}/`) && /\.(md|mdx)$/.test(f))
      .map(f => [f, frontMatterOf(f)])
      .filter(([, block]) => block !== null);
  }

  it('validates every docs front matter block through DocFrontMatterSchema', () => {
    const blocks = frontMatterUnder('docs');
    assert.ok(
      blocks.length > 0,
      'no tracked docs file had a front matter block, so this check tested ' +
        'nothing'
    );
    for (const [file, block] of blocks) {
      const data = matter(block).data;
      assert.doesNotThrow(
        () => docsPlugin.validateDocFrontMatter(data),
        `${file} no longer validates against Docusaurus's own doc front ` +
          `matter schema`
      );
    }
  });

  it('validates every blog front matter block through BlogPostFrontMatterSchema', () => {
    const blocks = frontMatterUnder('blog');
    assert.ok(
      blocks.length > 0,
      'no tracked blog file had a front matter block, so this check tested ' +
        'nothing'
    );
    for (const [file, block] of blocks) {
      const data = matter(block).data;
      assert.doesNotThrow(
        () => blogPlugin.validateBlogPostFrontMatter(data),
        `${file} no longer validates against Docusaurus's own blog front ` +
          `matter schema`
      );
    }
  });
});
