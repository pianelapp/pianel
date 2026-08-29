let pending: Promise<MIDIAccess> | null = null;

export function getMIDIAccess(): Promise<MIDIAccess> {
  if (pending) return pending;

  if (typeof navigator.requestMIDIAccess !== 'function') {
    return Promise.reject(
      new Error('Web MIDI API not available in this context'),
    );
  }

  const request = navigator.requestMIDIAccess({sysex: true}).catch(err => {
    if (pending === request) pending = null;
    throw err;
  });
  pending = request;
  return request;
}

export function resetMIDIAccess(): void {
  pending = null;
}
