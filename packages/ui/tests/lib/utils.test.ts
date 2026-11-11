import {cn} from '../../src/lib/utils';

describe('cn', () => {
  it('joins conditional class values like clsx', () => {
    expect(cn('a', false, null, undefined, {b: true, c: false}, ['d'])).toBe(
      'a b d',
    );
  });

  it('lets a later Tailwind utility override a conflicting earlier one', () => {
    expect(cn('px-2 py-1 bg-input', 'px-4', 'bg-primary')).toBe(
      'py-1 px-4 bg-primary',
    );
  });

  it('resolves Tailwind v4 renamed utilities as conflicts', () => {
    expect(cn('shadow-xs', 'shadow-sm')).toBe('shadow-sm');
    expect(cn('outline-hidden', 'outline-none')).toBe('outline-none');
  });
});
