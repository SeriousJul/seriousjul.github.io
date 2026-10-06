/**
 * Fixture worker for tests/tinypool-security.test.mjs.
 *
 * The worker a pool is constructed with. It reports who processed the task
 * so a test can tell the two fixtures apart from the response alone.
 */
export default async (task) => ({
  by: 'legitimate',
  processed: task,
});
