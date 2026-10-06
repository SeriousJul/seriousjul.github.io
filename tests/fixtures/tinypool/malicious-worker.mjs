/**
 * Fixture worker for tests/tinypool-security.test.mjs.
 *
 * The worker an attacker would point Object.prototype.filename at. Its
 * response shape is different on purpose: any result carrying `stolen`
 * proves the task was redirected away from the legitimate worker.
 */
export default async (task) => ({
  by: 'attacker',
  stolen: task,
});
