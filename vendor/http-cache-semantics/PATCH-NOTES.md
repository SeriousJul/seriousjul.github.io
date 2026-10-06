# Vendor copy of http-cache-semantics 4.3.1 (4.3.0 plus a stale-serving guard)

This directory is a vendored copy of the npm package `http-cache-semantics`,
kept in the repository because the registry has no version that fixes
CVE-2026-93748.

## Why it is vendored

CVE-2026-93748 (GHSA-ch52-4w7c-c8xp, high, CVSS 7.5): a shared cache built
on this library marks certain entries non-reusable across users by giving
them a zero freshness lifetime. The stale-serving branch of
`evaluateRequest()` then lets a client re-open that entry with a single
`Cache-Control: max-stale` request directive and receive the entry's body
and headers, including a `Set-Cookie` header computed for another user.

The advisory's vulnerable range is `<= 4.2.0`, but as of 2026-10-07 no
published version fixes the behaviour:

- `4.3.0` (the latest release, 2026-10-04) does not touch the stale-serving
  branch. The `max-stale` path in `index.js` is byte-identical between 4.2.0
  and 4.3.0. The release only exposes the response status code and changes
  `Vary` header matching.
- The advisory records `first_patched_version: null`.
- The maintainer disputes the report as contrary to RFC 9111 in
  kornelski/http-cache-semantics#56 (closed 2026-10-04, with the 4.3.0
  release) and the dispute is still open in
  github/advisory-database#10139.

There is nothing on the npm registry to upgrade to, so this project replaces
the registry copy with this patched copy through a direct `file:`
dependency plus the `overrides` field in the root `package.json`, the same
wiring as `vendor/braces`:

```json
"dependencies": {
  "http-cache-semantics": "file:vendor/http-cache-semantics"
},
"overrides": {
  "http-cache-semantics": "$http-cache-semantics"
}
```

The direct dependency is what makes the lockfile record the vendored
version at the top level. `http-cache-semantics` is otherwise transitive
here. The chain is `update-notifier` (a Docusaurus dev-server dependency)
to `latest-version` to `package-json` to `got` to `cacheable-request`
(`^4.1.1`). The range accepts this copy, and the override is what makes
`cacheable-request` resolve to it, so the override is the operative part
of the fix.

## What changed relative to 4.3.0

The version is bumped to 4.3.1, the next patch version, so the lockfile
records a version outside the vulnerable range `<= 4.2.0`.

1. `index.js` - new method `_isStaleServingProhibited()`. It returns `true`
   exactly when `maxAge()` zeroed the entry's lifetime to stop cross-user
   reuse: a `no-cache` response, a shared response that carries `Set-Cookie`
   without an explicit `public` or `immutable` opt-in, or a shared
   `proxy-revalidate` response. This mirrors the conditions inside
   `maxAge()` itself.

2. `index.js` - the stale branch of `evaluateRequest()` (which
   `satisfiesWithoutRevalidation()` delegates to) now computes
   `staleServingProhibited` and gates both stale-serving paths on it:

   - the `max-stale` hit: a prohibited entry is no longer served as a hit
     for any `max-stale` value. It falls through to
     `_evaluateRequestMissResult()`, which revalidates with the origin.
   - the `stale-while-revalidate` hit: a prohibited entry is no longer
     served stale while a background revalidation runs, for the same
     reason.

Entries whose lifetime expired the ordinary way (a plain `max-age` in the
past, with none of the prohibitions above) are unaffected: `max-stale` and
`stale-while-revalidate` keep their documented behaviour for them.

This implements the fix the report itself recommends ("refuse `max-stale`
when `this._isShared && this._resHeaders['set-cookie'] &&
!this._rescc.public`, or when `this._rescc['proxy-revalidate']`", plus
`no-cache`), so the vendored behaviour is traceable back to
GHSA-ch52-4w7c-c8xp either way the advisory-database dispute resolves. If
the advisory is withdrawn, the guard can be dropped and the dependency
returned to the registry; if a patched release is published, the override
can be removed in its favour.

## Files unchanged from 4.3.0

- `index.js` - unchanged apart from the two changes above.
- `package.json` - unchanged apart from the version. The `mocha`
  devDependency and the `test` script are dropped because the copy ships
  without the package's test suite, so the dev tool would only add packages
  to this project's tree.
- `README.md`, `LICENSE` - unchanged.

The package has no runtime dependencies, so the vendored copy is complete
by itself.

## How to verify

`tests/http-cache-semantics-security.test.mjs` pins the lockfile
replacement and the guard behaviour, including the positive controls that
prove ordinary `max-stale` use still works.

```sh
npm ci
npm test
```
