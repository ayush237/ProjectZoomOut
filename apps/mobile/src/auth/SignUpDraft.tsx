import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * The half-finished email signup, held between the details screen and the age gate.
 *
 * **It exists so the password never becomes a navigation param.** React Navigation
 * keeps params in its navigation state, and that state is serialisable by design — it
 * is what state persistence writes to disk, what the dev tools display, and what crash
 * reporters attach to a report. A plaintext password in there is inert only until one
 * of those is switched on, and then it is a credential leak that no code change caused.
 *
 * Held in a ref rather than only in state: the value is read once, at submit, and
 * re-rendering the tree because a password field changed is both pointless and one more
 * place the value can be observed.
 */

export interface SignUpDraft {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

interface SignUpDraftValue {
  readonly hasDraft: boolean;
  readonly setDraft: (draft: SignUpDraft) => void;
  readonly readDraft: () => SignUpDraft | null;
  readonly clearDraft: () => void;
}

const SignUpDraftContext = createContext<SignUpDraftValue | null>(null);

export function SignUpDraftProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const draft = useRef<SignUpDraft | null>(null);

  // Only *whether* a draft exists drives rendering — the age gate needs to know it has
  // something to submit. The draft itself never enters render.
  const [hasDraft, setHasDraft] = useState(false);

  const setDraft = useCallback((next: SignUpDraft): void => {
    draft.current = next;
    setHasDraft(true);
  }, []);

  const readDraft = useCallback((): SignUpDraft | null => draft.current, []);

  const clearDraft = useCallback((): void => {
    // Cleared on submit and on abandonment, so a password does not outlive the screen
    // that collected it.
    draft.current = null;
    setHasDraft(false);
  }, []);

  const value = useMemo(
    (): SignUpDraftValue => ({ hasDraft, setDraft, readDraft, clearDraft }),
    [hasDraft, setDraft, readDraft, clearDraft],
  );

  return <SignUpDraftContext.Provider value={value}>{children}</SignUpDraftContext.Provider>;
}

/** @throws {Error} when used outside a `SignUpDraftProvider`. */
export function useSignUpDraft(): SignUpDraftValue {
  const value = useContext(SignUpDraftContext);

  if (value === null) {
    throw new Error('useSignUpDraft must be used inside a SignUpDraftProvider');
  }

  return value;
}
