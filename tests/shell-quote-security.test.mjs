/**
 * Regression checks for the shell-quote pin in package-lock.json.
 *
 * Covers both open shell-quote advisories:
 *
 *   CVE-2026-9277   quote()  line terminators reach the output unescaped,
 *                          patched in 1.8.4 by a shape allowlist
 *   CVE-2026-13311  parse()  quadratic finalizer, patched in 1.9.0
 *
 * Dependency security check, not a frontend test. It uses the node:test runner
 * built into Node, so it adds no dependency. It reads shell-quote from the
 * project node_modules, so it exercises exactly the version the committed
 * lockfile resolves.
 *
 * Run after `npm ci`, through npm or directly:
 *
 *     npm test
 *     node tests/shell-quote-security.test.mjs
 *
 * Verified behaviour of this file against the four versions that matter, each
 * measured by installing it into the project tree and re-running this file:
 *
 *   1.8.3   the replaced version    fails 20 of 28
 *   1.8.4   clears one CVE only     fails 1 of 28, the version floor, and nothing else
 *   1.9.0   first patched for both  passes 28 of 28
 *   1.10.0  this pin                passes 28 of 28
 *
 * The 1.8.4 row is the point of the version floor. 1.8.4 clears CVE-2026-9277
 * only, and it satisfies every behavioural assertion below, because
 * CVE-2026-13311 is a performance defect with no observable output difference.
 * Without the floor this file cannot tell the pin it defends from a pin that
 * leaves npm audit red and one advisory open.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Load the package once and keep the binding. Every test here uses these
// references, and the reachability check patches require.cache for this exact
// path, which is populated only because this line ran first. Load it later and
// reordering the file fails with "Cannot set properties of undefined", an error
// that says nothing about the assertion being attempted.
const shellQuotePath = require.resolve('shell-quote');
const shellQuote = require('shell-quote');
const { parse, quote } = shellQuote;
const { version } = require('shell-quote/package.json');

// CVE-2026-13311 first patched. The floor the title of the change claims.
const MINIMUM_PIN = '1.9.0';

/**
 * A bare line terminator ends a POSIX command, so text after one parses as a
 * second command. quote() neutralises one by escaping it or by emitting it
 * inside single quotes, which a shell reads as literal data.
 *
 * LF and CR are the shell-relevant pair: a POSIX shell ends a command on one.
 * U+2028 and U+2029 are JavaScript line terminators, which is why the
 * vulnerable per-character escaping regex let them through. All four are
 * checked because on 1.8.3 quote() emits all four bare out of the op path.
 */
const LINE_TERMINATORS = [
  ['LF', '\n'],
  ['CR', '\r'],
  ['U+2028', '\u2028'],
  ['U+2029', '\u2029'],
];

const TERMINATOR_CHARS = LINE_TERMINATORS.map(([, char]) => char);

/** Name of the first line terminator outside single quotes, else null. */
function findBareLineTerminator(out) {
  let inSingleQuote = false;
  for (let i = 0; i < out.length; i += 1) {
    const char = out[i];
    if (char === "'") {
      inSingleQuote = !inSingleQuote;
    } else if (inSingleQuote) {
      // A POSIX shell reads single-quoted text literally, and there a
      // backslash is not an escape, so the skip below is deliberately not
      // applied in this branch.
    } else if (char === '\\') {
      i += 1;
    } else if (TERMINATOR_CHARS.includes(char)) {
      return LINE_TERMINATORS.find(([, c]) => c === char)[0];
    }
  }
  return null;
}

/**
 * What quote() did with a token list, without letting a throw escape.
 *
 * @returns {{ kind: 'rejected', message: string, name: string }
 *           | { kind: 'output', out: string, bare: string | null }}
 */
function classifyQuote(tokens) {
  let out;
  try {
    out = quote(tokens);
  } catch (error) {
    return {
      kind: 'rejected',
      name: error.constructor.name,
      message: error.message,
    };
  }
  return {
    kind: 'output',
    out: String(out),
    bare: findBareLineTerminator(String(out)),
  };
}

/**
 * Assert quote() rejected the token through its documented allowlist.
 *
 * The message is matched, not merely "some throw". 1.8.3 threw TypeError for a
 * comment token too, but with "Cannot read properties of undefined (reading
 * 'replace')" because it had no comment handling at all. An incidental crash
 * proves nothing about the fix, so it must not count as a pass.
 */
function assertRejected(tokens, expectedMessage, what) {
  const result = classifyQuote(tokens);
  if (result.kind === 'output') {
    assert.fail(
      `${what}: quote() accepted a hostile token and returned ` +
        `${JSON.stringify(result.out)} (bare terminator: ${result.bare ?? 'none'}) ` +
        `instead of rejecting it`
    );
  }
  assert.equal(
    result.name,
    'TypeError',
    `${what}: expected a TypeError, got ${result.name}: ${result.message}`
  );
  assert.match(
    result.message,
    expectedMessage,
    `${what}: rejected with an unexpected message, so the deliberate ` +
      `allowlist check cannot be told from an unrelated crash: ${result.message}`
  );
}

/**
 * Assert quote() could not be used to smuggle a bare command separator.
 *
 * Two outcomes satisfy this: the documented rejection, or output that keeps
 * every terminator escaped or inside single quotes. Used for the parse()
 * envFn route, where U+2028 and U+2029 take the second path even on 1.10.0.
 */
function assertCannotSmuggle(tokens, expectedMessage, what) {
  const result = classifyQuote(tokens);
  if (result.kind === 'rejected') {
    assert.equal(
      result.name,
      'TypeError',
      `${what}: expected a TypeError, got ${result.name}: ${result.message}`
    );
    assert.match(
      result.message,
      expectedMessage,
      `${what}: rejected with an unexpected message: ${result.message}`
    );
    return;
  }
  assert.equal(
    result.bare,
    null,
    `${what}: emitted a bare ${result.bare} command separator: ` +
      `${JSON.stringify(result.out)}`
  );
}

/** The three numeric parts of a version string. */
function semverParts(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text);
  assert.ok(match, `unrecognised shell-quote version: ${text}`);
  return match.slice(1).map(Number);
}

/** True when `a` is at or above `b`, compared numerically per part. */
function isAtOrAbove(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] > b[i]) {
      return true;
    }
    if (a[i] < b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Wrap the parse() export that launch-editor/guess.js will bind when it next
 * loads, run `body`, then restore. guess.js captures require('shell-quote') at
 * module scope, so the cache entry for guess.js must be dropped for a patch to
 * take effect, and dropped again on the way out so no later test inherits it.
 */
function withTracedParse(body) {
  const entry = require.cache[shellQuotePath];
  assert.ok(
    entry,
    `shell-quote is not in the require cache. It must be loaded at the top of ` +
      `this file before ${shellQuotePath} can be patched.`
  );

  const original = entry.exports;
  const calls = [];
  entry.exports = Object.assign(Object.create(null), original, {
    parse: (...args) => {
      calls.push(args[0]);
      return original.parse(...args);
    },
  });

  const guessPath = require.resolve('launch-editor/guess.js');
  const editorEnvVars = ['VISUAL', 'EDITOR', 'LAUNCH_EDITOR'];
  const savedEnv = editorEnvVars.map(key => [key, process.env[key]]);
  for (const key of editorEnvVars) {
    delete process.env[key];
  }

  try {
    delete require.cache[guessPath];
    body(require(guessPath));
  } finally {
    delete require.cache[guessPath];
    entry.exports = original;
    for (const [key, value] of savedEnv) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
  }

  assert.equal(
    require.cache[shellQuotePath].exports,
    original,
    'the require.cache patch was not restored, so later tests are contaminated'
  );
  return calls;
}

describe(`version floor: the pin must clear both advisories (${version})`, () => {
  it(`is at least ${MINIMUM_PIN}, first patched for CVE-2026-13311`, () => {
    assert.ok(
      isAtOrAbove(semverParts(version), semverParts(MINIMUM_PIN)),
      `shell-quote ${version} is below ${MINIMUM_PIN}, so its parse() finalizer ` +
        `is still quadratic and CVE-2026-13311 stays open. 1.8.4 clears ` +
        `CVE-2026-9277 and passes every behavioural check in this file, so this ` +
        `floor is the only thing that separates the two pins.`
    );
  });
});

describe('CVE-2026-9277: quote() rejects a line terminator deliberately', () => {
  // Each hostile shape below is paired with a clean token of the same shape in
  // the next block, so a pass can only come from the allowlist working, not
  // from the whole code path being broken.
  for (const [label, char] of LINE_TERMINATORS) {
    it(`rejects a terminator in an object token op (${label})`, () => {
      assertRejected(
        [{ op: `;${char}id` }],
        /invalid `op` value:/,
        `op ${label}`
      );
    });

    it(`rejects a terminator in a comment token (${label})`, () => {
      assertRejected(
        [{ comment: `c${char}id` }],
        /`comment` must not contain line terminators/,
        `comment ${label}`
      );
    });

    it(`rejects a terminator in a glob pattern (${label})`, () => {
      assertRejected(
        [{ op: 'glob', pattern: `a${char}b` }],
        /glob `pattern` must not contain line terminators/,
        `glob ${label}`
      );
    });

    // parse(cmd, envFn) splices whatever envFn returns straight into the token
    // array, so this is the injection route the advisory documents. LF and CR
    // reach quote() as an op token and hit the allowlist. U+2028 and U+2029 do
    // not: parse() round-trips an object env value through JSON inside a random
    // token marker, then splits on a regex that uses `.` to cross the marker,
    // and `.` does not match a JavaScript line terminator. The token survives
    // as single-quoted text instead, which a shell reads as data. That is a
    // containment path, not a rejection, so this case accepts either.
    it(`cannot smuggle a terminator through parse(cmd, envFn) (${label})`, () => {
      assertCannotSmuggle(
        parse('echo $X', () => ({ op: `;${char}id` })),
        /invalid `op` value:/,
        `envFn ${label}`
      );
    });
  }

  it('rejects a non-string op instead of coercing it', () => {
    assertRejected(
      [{ op: 1 }],
      /unrecognized object token shape/,
      'numeric op'
    );
  });

  it('rejects an unrecognized object shape instead of coercing it', () => {
    assertRejected(
      [{ nope: 'x\ny' }],
      /unrecognized object token shape/,
      'unknown token key'
    );
  });

  it('rejects a glob token with no string pattern', () => {
    assertRejected(
      [{ op: 'glob', pattern: 5 }],
      /glob token requires a string `pattern`/,
      'numeric glob pattern'
    );
  });
});

describe('CVE-2026-9277: the allowlist must not be over-tight', () => {
  it('every control operator parse() can emit still quotes', () => {
    for (const op of [
      '||',
      '&&',
      ';;',
      '|&',
      '<(',
      '<<<',
      '>>',
      '>&',
      '<&',
      '&',
      ';',
      '(',
      ')',
      '|',
      '<',
      '>',
    ]) {
      const result = classifyQuote([{ op }]);
      assert.equal(
        result.kind,
        'output',
        `operator ${JSON.stringify(op)} was rejected: ${result.message}`
      );
    }
  });

  it('a clean glob token quotes to its own pattern', () => {
    // 1.8.3 discarded the pattern and emitted the literal \g\l\o\b. That is why
    // the hostile glob cases above demand a rejection rather than settling for
    // terminator-free output: on 1.8.3 that output was terminator-free only
    // because the whole pattern had been thrown away.
    assert.equal(quote([{ op: 'glob', pattern: '*.js' }]), '*.js');
  });

  it('a clean comment token quotes', () => {
    assert.equal(quote([{ comment: 'note' }]), '#note');
  });

  it('plain strings and numbers quote', () => {
    assert.equal(quote(['echo', 'hi there', 42]), "echo 'hi there' 42");
  });

  it('parse then quote round trips real command lines', () => {
    const env = { X: 'x', Y: 'y' };
    for (const cmd of [
      'git commit -m "fix: thing" && npm run build',
      'cat < in | grep -v "^#" | sort',
      'make -j4 2>/dev/null || true',
      'a ; b ; c',
      '( a ) | b > f',
      'echo $X > out.txt 2>&1',
    ]) {
      const result = classifyQuote(parse(cmd, env));
      assert.equal(
        result.kind,
        'output',
        `round trip failed for ${cmd}: ${result.message}`
      );
    }
  });
});

describe('consumer contract: launch-editor is the only user here', () => {
  it('guessEditor() with no editor spec never reaches parse()', () => {
    // webpack-dev-server calls launchEditor(fileName) with no editor argument,
    // and guess.js only calls parse() when a spec is present, so a clean dev
    // server session never runs the code either advisory changed. If a future
    // webpack-dev-server starts passing a spec, this test fails and the
    // "hygiene only" conclusion gets revisited instead of going stale.
    const calls = withTracedParse(guessEditor => {
      guessEditor(undefined);
    });

    assert.deepEqual(
      calls,
      [],
      `parse() was reached with: ${JSON.stringify(calls)}`
    );
  });

  it('the parse() trace actually observes a call when one happens', () => {
    // Negative control for the check above. Without it the reachability test
    // would pass just as happily if the spy never wired up at all, since an
    // empty call list is what it asserts.
    const calls = withTracedParse(guessEditor => {
      guessEditor('code -r');
    });

    assert.deepEqual(calls, ['code -r']);
  });

  it('realistic editor specs still split into argv', () => {
    assert.deepEqual(parse('code -r'), ['code', '-r']);
    assert.deepEqual(parse("vim '+set number'"), ['vim', '+set number']);
    assert.deepEqual(parse('subl --wait file.txt'), [
      'subl',
      '--wait',
      'file.txt',
    ]);
  });
});
