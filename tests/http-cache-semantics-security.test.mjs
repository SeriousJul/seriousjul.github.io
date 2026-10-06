/**
 * Regression checks for the http-cache-semantics replacement in
 * package-lock.json.
 *
 * Covers CVE-2026-93748 (GHSA-ch52-4w7c-c8xp, high, CVSS 7.5). A shared
 * cache built on this library marks certain entries non-reusable across
 * users by giving them a zero freshness lifetime: a `no-cache` response,
 * a shared response that carries Set-Cookie without an explicit `public`
 * or `immutable` opt-in, and a shared `proxy-revalidate` response. The
 * stale-serving branch of `evaluateRequest()` let a client re-open such
 * an entry with a single `Cache-Control: max-stale` request directive
 * (or a `stale-while-revalidate` window) and receive the entry's body and
 * headers, including a `Set-Cookie` header computed for another user.
 *
 * There is no patched version to upgrade to. As of 2026-10-07 the latest
 * release is 4.3.0, and it does not touch the stale-serving branch: the
 * `max-stale` path in `index.js` is byte-identical between 4.2.0 and
 * 4.3.0. The advisory records `first_patched_version: null`, and the
 * upstream dispute (kornelski/http-cache-semantics#56,
 * github/advisory-database#10139) is still open. The registry copy is
 * therefore replaced with a vendored copy of 4.3.0 plus a stale-serving
 * guard (see vendor/http-cache-semantics/PATCH-NOTES.md), wired in from
 * the root manifest:
 *
 *     "dependencies": { "http-cache-semantics": "file:vendor/http-cache-semantics" },
 *     "overrides":    { "http-cache-semantics": "$http-cache-semantics" }
 *
 * The override is what reaches the transitive consumer,
 * `cacheable-request` (`^4.1.1`), whose chain here is
 * `update-notifier` to `latest-version` to `package-json` to `got` to
 * `cacheable-request`.
 *
 * Dependency security check, not a frontend test. It uses the node:test
 * runner built into Node, so it adds no dependency. It reads
 * http-cache-semantics from the project node_modules, so it exercises
 * exactly the version the committed lockfile resolves.
 *
 * Run after `npm ci`, through npm or directly:
 *
 *     npm test
 *     node tests/http-cache-semantics-security.test.mjs
 *
 * Verified behaviour of this file:
 *
 *   4.2.0   the locked registry version, and the whole vulnerable range
 *           the attack scenarios below are served from cache: the stale
 *           Set-Cookie entry is returned to the `max-stale` request with
 *           the victim's Set-Cookie header intact
 *   4.3.0   the latest registry release, also vulnerable: the
 *           stale-serving branch is unchanged, so the same scenarios are
 *           served
 *   4.3.1   this vendored copy
 *           the zeroed entries are revalidated instead of served, while
 *           plain max-stale and stale-while-revalidate use is unchanged
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

const CachePolicy = require('http-cache-semantics');
const { version } = require('http-cache-semantics/package.json');

// The advisory range is `<= 4.2.0` and no patched release exists, so the
// floor is the next patch version after the last published one, which the
// vendored copy declares.
const MINIMUM_VERSION = '4.3.1';

/** The three numeric parts of a version string. */
function semverParts(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text);
  assert.ok(match, `unrecognised http-cache-semantics version: ${text}`);
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

/** True when `candidate` satisfies a plain caret range. */
function satisfiesCaret(candidate, range) {
  const parts = semverParts(candidate);
  const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range);
  if (!caret) {
    assert.fail(`range this check cannot judge: ${range}`);
  }
  const [maj, min, pat] = caret.slice(1).map(Number);
  return parts[0] === maj && isAtOrAbove(parts, [maj, min, pat]);
}

/** The `http-cache-semantics` entries in the committed lockfile. */
function lockfileEntries() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
  );
  const entries = Object.entries(lock.packages).filter(([key]) => {
    if (!/(^|\/)http-cache-semantics$/.test(key)) return false;
    // @types/http-cache-semantics is a different package, not the one
    // the advisory points at.
    return !key.endsWith('@types/http-cache-semantics');
  });
  assert.ok(
    entries.length > 0,
    'package-lock.json has no http-cache-semantics entry at all, so this ' +
      'test is not looking at the manifest the advisory points at'
  );
  return entries;
}

/**
 * Build a CachePolicy the way cacheable-request builds one: a stored
 * response for one URL, read back with a later request. The stored
 * response is aged to `ageSeconds` with its Age header, which pins the
 * age without waiting or monkey-patching the clock.
 */
function storedResponse(resHeaders, ageSeconds, shared = true) {
  const request = {
    url: 'http://example.com/data',
    method: 'GET',
    headers: { host: 'example.com' },
  };
  const response = {
    status: 200,
    headers: { ...resHeaders, age: String(ageSeconds) },
  };
  return new CachePolicy(request, response, { shared });
}

/** A later request for the same entry. */
function incomingRequest(cacheControl) {
  const headers = { host: 'example.com' };
  if (cacheControl !== undefined) {
    headers['cache-control'] = cacheControl;
  }
  return { url: 'http://example.com/data', method: 'GET', headers };
}

describe(`lockfile replacement: the copy must sit outside <= 4.2.0 (${version})`, () => {
  it(`installs at least ${MINIMUM_VERSION}, outside the vulnerable range`, () => {
    assert.ok(
      isAtOrAbove(semverParts(version), semverParts(MINIMUM_VERSION)),
      `http-cache-semantics ${version} is inside the vulnerable range ` +
        `<= 4.2.0, so CVE-2026-93748 stays open. The vendored copy ` +
        `declares ${MINIMUM_VERSION}, the next patch version after the ` +
        `last published one.`
    );
  });

  it('resolves to exactly one copy, and it is the vendored patched copy', () => {
    const entries = lockfileEntries();
    assert.deepEqual(
      entries.map(([key]) => key).sort(),
      ['node_modules/http-cache-semantics', 'vendor/http-cache-semantics'],
      `the lockfile holds an unexpected set of http-cache-semantics ` +
        `entries (${entries.map(([key]) => key).join(', ')}). A registry ` +
        `copy or a second nested copy would be a second resolved version ` +
        `that this replacement does not cover.`
    );
    const byKey = Object.fromEntries(entries);
    const vendored = byKey['vendor/http-cache-semantics'];
    assert.equal(
      vendored.version,
      version,
      `vendor/http-cache-semantics says ${vendored.version} but ` +
        `node_modules holds ${version}, so the version this file proves ` +
        `safe is not the version a fresh CI \`npm ci\` will install.`
    );
    const linked = byKey['node_modules/http-cache-semantics'];
    assert.equal(
      linked.link,
      true,
      'node_modules/http-cache-semantics is not a link'
    );
    assert.equal(
      linked.resolved,
      'vendor/http-cache-semantics',
      `node_modules/http-cache-semantics resolves to ${linked.resolved}, ` +
        `not the vendored copy`
    );
    for (const [key, entry] of entries) {
      assert.ok(
        !String(entry.resolved || '').startsWith(
          'https://registry.npmjs.org/http-cache-semantics'
        ),
        `${key} still resolves to a registry copy of http-cache-semantics, ` +
          `the vulnerable source`
      );
    }
  });

  it('pins the replacement in the root manifest, not just the lockfile', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    );
    assert.equal(
      manifest.dependencies?.['http-cache-semantics'],
      'file:vendor/http-cache-semantics',
      'the root manifest no longer points http-cache-semantics at the ' +
        'vendored copy, so the next install can replace it with the ' +
        'registry version'
    );
    assert.equal(
      manifest.overrides?.['http-cache-semantics'],
      '$http-cache-semantics',
      'the root manifest no longer overrides transitive ' +
        'http-cache-semantics with the direct dependency, so ' +
        'cacheable-request can install its own registry copy'
    );
  });

  it('keeps every dependent range satisfied, so a reinstall cannot roll it back', () => {
    const lock = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')
    );
    const ranges = [];
    for (const [key, entry] of Object.entries(lock.packages)) {
      if (key === '') continue; // the root copy is the replacement, not a consumer
      const declared = entry.dependencies?.['http-cache-semantics'];
      if (declared) ranges.push([key, declared]);
    }
    assert.ok(
      ranges.length >= 1,
      'expected cacheable-request to appear in the lockfile as the ' +
        'http-cache-semantics consumer'
    );
    for (const [consumer, range] of ranges) {
      assert.ok(
        satisfiesCaret(version, range),
        `${consumer} requires http-cache-semantics ${range}, and the ` +
          `replaced ${version} does not satisfy it, so a fresh install ` +
          `would replace the vendored copy`
      );
    }
  });

  it('exposes the API surface the consumers call', () => {
    // cacheable-request constructs a policy per stored response and asks
    // it satisfiesWithoutRevalidation, revalidatedPolicy and toObject;
    // the guard must not have removed anything it relies on.
    const policy = storedResponse(
      { 'cache-control': 'max-age=3600', date: new Date(0).toUTCString() },
      100
    );
    for (const name of [
      'evaluateRequest',
      'satisfiesWithoutRevalidation',
      'revalidatedPolicy',
      'storable',
      'stale',
      'maxAge',
      'timeToLive',
      'toObject',
    ]) {
      assert.equal(
        typeof policy[name],
        'function',
        `http-cache-semantics ${version} no longer exposes ${name}()`
      );
    }
    assert.equal(
      typeof CachePolicy.fromObject,
      'function',
      `http-cache-semantics ${version} no longer exposes fromObject()`
    );
  });
});

describe('CVE-2026-93748: zeroed entries are not re-served via max-stale', () => {
  // The reported attack. A shared cache stored a response that carries
  // Set-Cookie without public or immutable. The library zeroed its
  // lifetime to stop the entry being reused across users, but the stale
  // branch handed it to any client willing to accept stale.

  it('refuses max-stale for a shared Set-Cookie entry without public', () => {
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600',
        'set-cookie': 'session=victim-credential',
        date: new Date(0).toUTCString(),
      },
      4000
    );
    assert.ok(policy.stale(), 'the test setup must produce a stale entry');
    assert.equal(policy.maxAge(), 0, 'the entry lifetime must be zeroed');

    const result = policy.evaluateRequest(
      incomingRequest('max-stale=999999')
    );
    assert.equal(
      result.response,
      undefined,
      'the entry was served to the max-stale request, so the victim\'s ' +
        'Set-Cookie is disclosed'
    );
    assert.ok(
      result.revalidation && result.revalidation.synchronous,
      'the entry must be revalidated with the origin, not served stale'
    );
  });

  it('refuses max-stale for a shared proxy-revalidate entry', () => {
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600, proxy-revalidate',
        date: new Date(0).toUTCString(),
      },
      4000
    );
    assert.equal(
      policy.maxAge(),
      0,
      'the proxy-revalidate lifetime must be zeroed in a shared cache'
    );
    const result = policy.evaluateRequest(
      incomingRequest('max-stale=999999')
    );
    assert.equal(result.response, undefined);
    assert.ok(result.revalidation && result.revalidation.synchronous);
  });

  it('refuses max-stale for a no-cache entry', () => {
    const policy = storedResponse(
      {
        'cache-control': 'no-cache, max-age=3600',
        date: new Date(0).toUTCString(),
      },
      4000
    );
    assert.equal(
      policy.maxAge(),
      0,
      'the no-cache lifetime must be zeroed'
    );
    const result = policy.evaluateRequest(
      incomingRequest('max-stale=999999')
    );
    assert.equal(result.response, undefined);
    assert.ok(result.revalidation && result.revalidation.synchronous);
  });

  it('refuses stale-while-revalidate for a shared Set-Cookie entry', () => {
    // The second stale-serving path. The entry is inside the
    // stale-while-revalidate window (0 + 600 > 300), so the vulnerable
    // version serves it stale with a background revalidation.
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600, stale-while-revalidate=600',
        'set-cookie': 'session=victim-credential',
        date: new Date(0).toUTCString(),
      },
      300
    );
    assert.ok(policy.stale(), 'the test setup must produce a stale entry');
    const result = policy.evaluateRequest(incomingRequest());
    assert.equal(
      result.response,
      undefined,
      'the entry was served while revalidating, so the victim\'s ' +
        'Set-Cookie is disclosed'
    );
    assert.ok(
      result.revalidation && result.revalidation.synchronous,
      'the entry must be revalidated with the origin, not served stale'
    );
  });
});

describe('max-stale keeps working where the guard must not reach', () => {
  // Positive controls. The guard must change nothing for entries whose
  // lifetime expired the ordinary way, for private caches, and for
  // entries the origin explicitly opted into sharing.

  it('serves max-stale for a plain shared entry with no prohibitions', () => {
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600',
        'x-marker': 'plain-entry',
        date: new Date(0).toUTCString(),
      },
      4000
    );
    assert.ok(policy.stale());
    const result = policy.evaluateRequest(
      incomingRequest('max-stale=999999')
    );
    assert.ok(
      result.response,
      'a plain stale entry must still be served to a max-stale request'
    );
    assert.equal(result.revalidation, undefined);
    assert.equal(result.response.headers['x-marker'], 'plain-entry');
  });

  it('serves max-stale for a private-cache Set-Cookie entry', () => {
    // A private (per-user) cache has no cross-user reuse, so the
    // prohibition does not apply and the documented max-stale behaviour
    // is preserved.
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600',
        'set-cookie': 'session=own-credential',
        date: new Date(0).toUTCString(),
      },
      4000,
      false
    );
    assert.equal(policy.maxAge(), 3600, 'a private entry is not zeroed');
    const result = policy.evaluateRequest(
      incomingRequest('max-stale=999999')
    );
    assert.ok(result.response, 'the private entry must still be served');
    assert.equal(result.revalidation, undefined);
  });

  it('serves max-stale for a shared Set-Cookie entry with explicit public', () => {
    // public is the explicit opt-in into shared reuse, so the lifetime
    // is not zeroed and max-stale applies as documented.
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600, public',
        'set-cookie': 'session=opted-in',
        date: new Date(0).toUTCString(),
      },
      4000
    );
    assert.equal(policy.maxAge(), 3600, 'a public entry is not zeroed');
    const result = policy.evaluateRequest(
      incomingRequest('max-stale=999999')
    );
    assert.ok(result.response, 'the public entry must still be served');
    assert.equal(result.revalidation, undefined);
  });

  it('serves max-stale for a shared Set-Cookie entry with explicit immutable', () => {
    // immutable is the second explicit opt-in into shared reuse in this
    // implementation, mirroring maxAge(). The guard uses the same
    // condition, so it must not reach these entries either.
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600, immutable',
        'set-cookie': 'session=opted-in',
        date: new Date(0).toUTCString(),
      },
      4000
    );
    assert.notEqual(policy.maxAge(), 0, 'an immutable entry is not zeroed');
    const result = policy.evaluateRequest(
      incomingRequest('max-stale=999999')
    );
    assert.ok(result.response, 'the immutable entry must still be served');
    assert.equal(result.revalidation, undefined);
  });

  it('serves stale-while-revalidate for a plain shared entry', () => {
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600, stale-while-revalidate=600',
        'x-marker': 'swr-entry',
        date: new Date(0).toUTCString(),
      },
      4000
    );
    assert.ok(policy.stale());
    const result = policy.evaluateRequest(incomingRequest());
    assert.ok(
      result.response,
      'a plain stale entry must still be served inside its SWR window'
    );
    assert.ok(
      result.revalidation && result.revalidation.synchronous === false,
      'the SWR serve must come with an asynchronous revalidation'
    );
  });

  it('serves a fresh entry without any stale directive', () => {
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600',
        'x-marker': 'fresh-entry',
        date: new Date(0).toUTCString(),
      },
      100
    );
    assert.ok(!policy.stale(), 'the test setup must produce a fresh entry');
    const result = policy.evaluateRequest(incomingRequest());
    assert.ok(result.response, 'a fresh entry must be served');
    assert.equal(result.revalidation, undefined);
  });

  it('still revalidates a stale plain entry without max-stale', () => {
    // The default path for a stale entry the client did not accept stale:
    // unchanged by the guard.
    const policy = storedResponse(
      {
        'cache-control': 'max-age=3600',
        date: new Date(0).toUTCString(),
      },
      4000
    );
    assert.ok(policy.stale());
    const result = policy.evaluateRequest(incomingRequest());
    assert.equal(result.response, undefined);
    assert.ok(result.revalidation && result.revalidation.synchronous);
  });
});
