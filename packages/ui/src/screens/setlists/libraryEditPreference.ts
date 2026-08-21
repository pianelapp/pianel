export type RememberedLibraryEditChoice = 'everywhere' | 'thisGig';

const KEY = 'pianel:libraryEditChoice';

export function readLibraryEditPreference(): RememberedLibraryEditChoice | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw === 'everywhere' || raw === 'thisGig' ? raw : null;
  } catch {
    return null;
  }
}

export function writeLibraryEditPreference(choice: RememberedLibraryEditChoice): void {
  try {
    window.sessionStorage.setItem(KEY, choice);
  } catch {
    return;
  }
}

export function clearLibraryEditPreference(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
}
