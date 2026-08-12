import { act } from '@testing-library/react-native';

/**
 * Runs a synchronous call inside `act` and lets the promises it started settle.
 *
 * The plain idiom — `await act(async () => { thing(); })` — trips
 * `@typescript-eslint/require-await`, because the callback is marked async but awaits
 * nothing. Suppressing the rule per call site would be noise, and dropping the `async`
 * changes the behaviour: `act` only flushes the microtask queue for the async form, and
 * a handler that kicks off a fetch would then be asserted on before its state update
 * lands.
 *
 * The `await` here is real and is the point — it is what yields to the queued
 * continuations.
 */
export async function flush(run: () => void): Promise<void> {
  await act(async () => {
    run();
    await Promise.resolve();
  });
}
