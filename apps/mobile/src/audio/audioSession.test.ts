// Jest hoists `jest.mock` above this file's own bindings and statically refuses a
// factory that closes over one — `mockSetAudioModeAsync` is the documented exception:
// a name prefixed `mock` (case-insensitive) is allowed through the check.
const mockSetAudioModeAsync = jest.fn((_mode: unknown) => Promise.resolve());

jest.mock('expo-audio', () => ({
  setAudioModeAsync: (mode: unknown) => mockSetAudioModeAsync(mode),
}));

import { configureNarrationAudioSession } from './audioSession';

describe('configureNarrationAudioSession', () => {
  beforeEach(() => {
    mockSetAudioModeAsync.mockClear();
  });

  it('configures the session for silent-switch playback, explicitly', async () => {
    await configureNarrationAudioSession();

    expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
  });
});
