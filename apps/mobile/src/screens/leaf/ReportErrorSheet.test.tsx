import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import { ThemeProvider } from '../../design';
import { ReportErrorSheet } from './ReportErrorSheet';

/**
 * Tier B, one happy path — plus the failure path, since "the sheet stays open and says
 * so" is exactly the behaviour a legal correction channel cannot afford to lose, and it
 * had zero coverage before this package.
 *
 * **`userEvent`, not `fireEvent` + a hand-rolled `act()`.** The latter reliably left a
 * *later*, unrelated test unable to find elements that were plainly in its own tree —
 * `render()`'s own testID was findable, the query for it was not. `leafPlayer.test.tsx`
 * already settled on `userEvent` for exactly this kind of interaction, so this file
 * follows it rather than re-litigating the question.
 *
 * `report-scrim` is queried with `includeHiddenElements: true`: it is
 * `accessibilityElementsHidden` on purpose (see `ReportErrorSheet.tsx`), which is
 * exactly what makes it invisible to the default, accessibility-tree-based query.
 */

afterEach(async () => {
  await cleanup();
});

describe('ReportErrorSheet', () => {
  it('runs end to end: pick a reason, add detail, submit, and reach the confirmation', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const user = userEvent.setup();

    await render(
      <ThemeProvider mode="dark">
        <ReportErrorSheet visible onClose={onClose} onSubmit={onSubmit} />
      </ThemeProvider>,
    );

    // Submit is disabled with no reason chosen yet.
    expect(screen.getByTestId('report-submit')).toBeDisabled();

    await user.press(screen.getByTestId('report-reason-factual_error'));
    await user.type(screen.getByTestId('report-detail'), 'The date given is wrong.');
    await user.press(screen.getByTestId('report-submit'));

    expect(onSubmit).toHaveBeenCalledWith('factual_error', 'The date given is wrong.');
    expect(screen.getByTestId('report-confirmation')).toHaveTextContent('Thank you — we have this.');

    await user.press(screen.getByTestId('report-done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves the sheet open with a readable message when the submit fails', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('The server is not reachable.'));
    const user = userEvent.setup();

    await render(
      <ThemeProvider mode="dark">
        <ReportErrorSheet visible onClose={() => {}} onSubmit={onSubmit} />
      </ThemeProvider>,
    );

    await user.press(screen.getByTestId('report-reason-other'));
    await user.press(screen.getByTestId('report-submit'));

    expect(screen.getByTestId('report-error')).toBeTruthy();
    expect(screen.getByText('The server is not reachable.')).toBeTruthy();
    // Still on the form, not the confirmation — a failed report is not a sent one.
    expect(screen.queryByTestId('report-confirmation')).toBeNull();
    expect(screen.getByTestId('report-submit')).toBeTruthy();
  });

  it('closes without submitting from the close button', async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();

    await render(
      <ThemeProvider mode="dark">
        <ReportErrorSheet visible onClose={onClose} onSubmit={onSubmit} />
      </ThemeProvider>,
    );

    await user.press(screen.getByTestId('report-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes without submitting from tapping the scrim', async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();

    await render(
      <ThemeProvider mode="dark">
        <ReportErrorSheet visible onClose={onClose} onSubmit={onSubmit} />
      </ThemeProvider>,
    );

    await user.press(screen.getByTestId('report-scrim', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
