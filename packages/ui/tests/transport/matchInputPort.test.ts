import {matchInputPort} from '../../src/transport/matchInputPort';

const PEDAL = {id: 'in-pedal', name: 'FootCtrlPlus Bluetooth'};
const PIANO_SUFFIXED = {id: 'in-piano', name: 'FP-30X MIDI 1'};
const PIANO_EXACT = {id: 'in-piano', name: 'FP-30X'};

describe('matchInputPort', () => {
  it('prefers an exact name match over enumeration order', () => {
    const result = matchInputPort([PEDAL, PIANO_EXACT], 'FP-30X');
    expect(result).toEqual({port: PIANO_EXACT, how: 'exact'});
  });

  it('matches an input whose name extends the output name', () => {
    const result = matchInputPort([PEDAL, PIANO_SUFFIXED], 'FP-30X');
    expect(result).toEqual({port: PIANO_SUFFIXED, how: 'prefix'});
  });

  it('matches an input whose name the output name extends', () => {
    const result = matchInputPort([PEDAL, PIANO_EXACT], 'FP-30X MIDI 1');
    expect(result).toEqual({port: PIANO_EXACT, how: 'prefix'});
  });

  it('ignores case and surrounding whitespace', () => {
    const result = matchInputPort([{id: 'a', name: '  fp-30x  '}], 'FP-30X');
    expect(result!.how).toBe('exact');
  });

  it('falls back to the first input when nothing matches', () => {
    const result = matchInputPort([PEDAL], 'FP-30X');
    expect(result).toEqual({port: PEDAL, how: 'fallback'});
  });

  it('falls back when the output has no usable name', () => {
    expect(matchInputPort([PEDAL], null)!.how).toBe('fallback');
    expect(matchInputPort([PEDAL], '   ')!.how).toBe('fallback');
  });

  it('returns null when there is nothing to match against', () => {
    expect(matchInputPort([], 'FP-30X')).toBeNull();
  });

  it('never returns an excluded input, even as the fallback', () => {
    expect(matchInputPort([PEDAL], 'FP-30X', ['in-pedal'])).toBeNull();
    expect(
      matchInputPort([PEDAL, PIANO_SUFFIXED], 'FP-30X', ['in-pedal']),
    ).toEqual({port: PIANO_SUFFIXED, how: 'prefix'});
  });

  it('does not treat an unnamed input as matching an unnamed output', () => {
    const unnamed = {id: 'x', name: null};
    expect(matchInputPort([unnamed], null)).toEqual({port: unnamed, how: 'fallback'});
  });

  it('takes the first prefix match when several inputs qualify', () => {
    const one = {id: 'a', name: 'FP-30X MIDI 1'};
    const two = {id: 'b', name: 'FP-30X MIDI 2'};
    expect(matchInputPort([one, two], 'FP-30X')).toEqual({port: one, how: 'prefix'});
  });
});
