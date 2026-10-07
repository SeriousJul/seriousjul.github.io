# Personal Website (seriousjul.github.io)

A single-context repository: a Docusaurus static site, its build tooling, and its
dependency policy. The deployed artifact is static output on the `gh-pages`
branch; no Node.js dependency runs there.

## Language

**Local patch**:
Source of a third-party package that this project changed, installed in place of
the registry copy. Forbidden by ADR-0001.
_Avoid_: vendored copy, vendored package, vendor folder

**Registry version pin**:
Selection of a published registry version through `overrides`. The sanctioned way
to answer an advisory.
_Avoid_: override hack

**Dependency replacement**:
Removal of an unhealthy dependency, or of the code path that reaches it, in place
of patching it.
_Avoid_: workaround, fork

**Qualifies for (an advisory)**:
Property of a project that runs the vulnerable code path with data an outside
party can influence. A fact about the code, not a measure of risk appetite.
_Avoid_: affected by, exposed to, at risk from

**Toolchain dependency**:
A package that runs only while this repository is built or served, never in the
deployed site. Being a toolchain dependency does not by itself mean the project
does not qualify for an advisory.
_Avoid_: dev dependency (that names the manifest section, not the runtime role)
