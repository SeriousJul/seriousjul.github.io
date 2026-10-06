/**
 * Fixture worker for tests/tinypool-security.test.mjs.
 *
 * The worker that reports back the environment the pool gave it. The
 * worker-options pollution checks read two things off its response: the
 * marker key, which only appears if the pool handed the worker a caller or
 * attacker env object, and PATH, which a polluted prototype object never
 * carries, so its absence proves the worker ran with the attacker's object
 * instead of the host environment.
 */
export default async () => ({
  by: 'env-report',
  marker: process.env.TINYPPOOL_ENV_MARKER ?? null,
  hasPath: process.env.PATH != null,
});
