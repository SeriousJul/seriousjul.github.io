# No local patches to third-party dependencies

Two advisories had no upstream fix, and the first answer was a local patch: full
copies of `braces` and `http-cache-semantics` under `vendor/`, wired in with
`file:` dependencies and `overrides`. That removed the changed source from the
dependency graph rather than proving it safe, and it left this repository
carrying third-party source it does not own. We decided this project never
patches third-party source locally. When an advisory has no upstream fix, the
response is a reachability analysis, a registry version pin where one exists, and
replacement of the dependency or of the code path that reaches it when the
dependency is unhealthy.

## Why the local patch was wrong

The advisory ranges were `braces <= 3.0.3` (CVE-2026-93687,
`first_patched_version: null`) and `http-cache-semantics <= 4.2.0`
(CVE-2026-93748, disputed upstream, `first_patched_version: null`). The vendored
copies declared versions 3.0.4 and 4.3.1, and Dependabot alerts #57 and #58 moved
to `fixed`. They moved because the package names left the graph, not because
GitHub saw a patched package. The repository SBOM reported
`pkg:npm/vendor/braces@3.0.4` and `pkg:npm/vendor/http-cache-semantics@4.3.1`,
held no `braces` entry at all, and carried no license data for either copy. A
scan of the shipped tree could no longer see what the project actually runs.

`npm ci` also fails late when a local path dependency is missing. With the
`file:` target absent, `npm ci` exits 0 and leaves a dangling symlink in
`node_modules`; the build then dies with `MODULE_NOT_FOUND`. A committed
directory that a lockfile depends on is a silent single point of failure.

## Considered options

- Keep the patched copies in this repository, with provenance and expiry checks.
  Rejected: it keeps changed third-party source in the dependency path, and the
  graph blindness stays.
- Move the patched copies to a separate repository and consume them by git URL or
  tarball. Rejected: same deviation, plus a second repository and a cross-repo
  release step for two patches.
- Commit `patches/*.patch` and apply them with `patch-package` on `postinstall`.
  Rejected: the lockfile keeps `braces@3.0.3`, so the advisory stays open, and a
  `postinstall` hook adds an install-time dependency of its own.
- Accept the advisories on the grounds that both packages are toolchain
  dependencies. Rejected as a reason: toolchain-only use is not the argument. The
  argument is that the project does not qualify. See the analyses below.

## Reachability: this project does not qualify

These analyses are the evidence behind the Dependabot dismissals.

**`braces`, CVE-2026-93687.** The vulnerable code is the recursive AST walkers
(`compile`, `expand`, `stringify`), which had no depth guard. Patterns reach
`braces` only through `micromatch` (used by `globby` and by
`@docusaurus/utils` `globUtils.createMatcher`, which calls
`Micromatch.makeRe(pattern)`) and through `chokidar`. Both receive patterns
authored in this repository's committed configuration. File paths are the strings
being matched; they are never parsed as patterns. The attack needs a pattern of
about 9999 characters nested 4999 levels deep. A path component on the CI
filesystem is at most 255 bytes, and no committed pattern in this repository is
near that length. No outside party can supply a pattern to this build.

**`http-cache-semantics`, CVE-2026-93748.** The package is reached only through
`@docusaurus/core` `bin/beforeCli.mjs` to `update-notifier` to `latest-version`
to `package-json` to `got` to `cacheable-request`. The advisory describes a
shared cache that returns one user's `Set-Cookie` to another user through a
`max-stale` request. This project has one local user and one local cache file at
`~/.config/configstore/update-notifier-@docusaurus`. There is no shared cache and
no multi-user serving. `update-notifier` also disables itself when
`NO_UPDATE_NOTIFIER` is present in the environment, so CI sets that variable and
the code path never runs there.

## Consequences

- `braces` resolves back to the registry 3.0.3, which is inside the advisory
  range, so its Dependabot alert reopens. It is dismissed with reason `not_used`
  and a comment that cites this ADR.
- `http-cache-semantics` resolves to the registry 4.3.0, which is outside the
  advisory range `<= 4.2.0`, so it raises no alert. The behaviour the disputed
  advisory describes is unchanged in 4.3.0; the dismissal rests on the analysis
  above, not on the version.
- The dependency graph and SBOM name the real packages again.
- `tests/dependency-policy.test.mjs` fails the build when a dependency spec is
  anything other than a plain registry semver range, or when a path under
  `vendor/` is tracked. Git URLs and tarball URLs are local patches parked
  elsewhere, so they fail too. Adding a fork dependency requires a new ADR.
- Registry version pins that already exist (`postcss-selector-parser`,
  `tinypool`) stay. They select published registry versions, so they are version
  selection, not patching.
- Exit condition: when upstream publishes a fix, Dependabot security updates open
  the pull request on their own. When an advisory stays open with no upstream
  fix, the response is the reachability analysis, a registry pin where one
  exists, and an evaluation of a replacement dependency at the next dependency
  review.
