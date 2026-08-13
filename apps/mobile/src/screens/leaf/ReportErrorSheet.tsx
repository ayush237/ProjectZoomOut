import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import type { ErrorReportReason } from '@zoomout/shared';

import { Button, Icon, StatusMessage, Text, TextField } from '../../components';
import { MIN_TOUCH_TARGET, useTheme } from '../../design';

/**
 * "Report an error", as the reader sees it.
 *
 * **This is a legal requirement, not a feedback form** (`LEGAL.md`, `PRODUCT.md`): every
 * Leaf must carry a correction channel, and it is part of what makes the fair-use
 * position defensible. Two consequences shape the design:
 *
 *  - **Reachable, not buried.** It sits in the player's chrome on every slide, so a
 *    reader who spots a wrong claim can act while looking at it.
 *  - **Receipt is explicit.** The sheet stays open after submitting and says the report
 *    was received, with what happens next. A silent dismissal reads as being ignored,
 *    which is exactly the impression a correction channel exists to prevent.
 *
 * The reasons are a closed list because the queue has to be sortable by a human — and
 * `wrong_answer` is separate from `factual_error` deliberately: an option marked correct
 * that is not means the payoff gate is teaching the wrong thing.
 */

const REASONS: readonly { value: ErrorReportReason; label: string; hint: string }[] = [
  {
    value: 'factual_error',
    label: 'Something here is factually wrong',
    hint: 'A claim, quote or attribution that does not match the book.',
  },
  {
    value: 'wrong_answer',
    label: 'The wrong option is marked correct',
    hint: 'The scenario is grading the wrong answer.',
  },
  {
    value: 'offensive',
    label: 'This content is offensive',
    hint: 'Something here should not be in the app.',
  },
  { value: 'other', label: 'Something else', hint: 'Tell us in your own words.' },
];

export interface ReportErrorSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (reason: ErrorReportReason, detail: string) => Promise<void>;
}

export function ReportErrorSheet({
  visible,
  onClose,
  onSubmit,
}: ReportErrorSheetProps): React.JSX.Element {
  const theme = useTheme();

  const [reason, setReason] = useState<ErrorReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /** Every dismissal resets, so re-opening never shows the last report's state. */
  const close = (): void => {
    setReason(null);
    setDetail('');
    setError(null);
    setSent(false);
    setBusy(false);
    onClose();
  };

  const submit = (): void => {
    if (reason === null) {
      return;
    }

    setBusy(true);
    setError(null);

    void (async () => {
      try {
        await onSubmit(reason, detail);
        setSent(true);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Could not send that report. Please try again.',
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View
        testID="report-sheet"
        style={{ flex: 1, backgroundColor: theme.surfaceFor('page'), padding: theme.spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="h2" style={{ flex: 1 }}>
            {sent ? 'Report received' : 'Report an error'}
          </Text>
          <Pressable
            testID="report-close"
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={theme.spacing.md}
            style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' }}
          >
            <Icon name="close" size={24} color={theme.palette.textMuted} />
          </Pressable>
        </View>

        {sent ? (
          /**
           * The receipt, and what happens next.
           *
           * Naming a review window matters: `LEGAL.md`'s SLA is a promise to the reader
           * as much as an internal process, and "thanks" without a timeframe is the
           * silence this screen exists to avoid.
           */
          <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.xl }}>
            <Icon name="success" size={40} color={theme.palette.correct} />
            <Text variant="h3" testID="report-confirmation">
              Thank you — we have this.
            </Text>
            <Text variant="body" tone="textMuted">
              Every report is read by a person. Anything that looks like a factual error
              or a wrong answer is reviewed within one working day, and content that
              needs pulling comes down the same day.
            </Text>
            <Button label="Done" onPress={close} testID="report-done" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <Text variant="body" tone="textMuted">
              This Leaf is generated from a book ZoomOut does not own. If something here
              is wrong, telling us is how it gets fixed.
            </Text>

            {error === null ? null : (
              <StatusMessage tone="error" message={error} testID="report-error" />
            )}

            <View style={{ gap: theme.spacing.md }}>
              {REASONS.map((option) => {
                const selected = reason === option.value;

                return (
                  <Pressable
                    key={option.value}
                    testID={`report-reason-${option.value}`}
                    onPress={() => {
                      setReason(option.value);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={{
                      minHeight: MIN_TOUCH_TARGET,
                      padding: theme.spacing.lg,
                      borderRadius: theme.radius.lg,
                      backgroundColor: theme.surfaceFor('card'),
                      // Selection is a border *and* a check icon, never colour alone.
                      borderWidth: selected ? theme.borderWidth.focus : theme.borderWidth.hairline,
                      borderColor: selected ? theme.palette.primary : theme.palette.border,
                      gap: theme.spacing.xs,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Icon
                        name={selected ? 'added' : 'info'}
                        size={18}
                        color={selected ? theme.palette.primary : theme.palette.textMuted}
                      />
                      <Text variant="body" style={{ flex: 1 }}>
                        {option.label}
                      </Text>
                    </View>
                    <Text variant="small" tone="textMuted">
                      {option.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextField
              testID="report-detail"
              label="Anything else? (optional)"
              value={detail}
              onChangeText={setDetail}
              placeholder="What did you notice?"
              multiline
            />

            <Button
              testID="report-submit"
              label="Send report"
              onPress={submit}
              busy={busy}
              // A reason is the one required field; the text is genuinely optional.
              disabled={reason === null}
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
