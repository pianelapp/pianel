import {FP30XEngine} from '../../../src/engine/fp30x/FP30XEngine';
import {ADDR} from '../../../src/engine/fp30x/addresses';

describe('FP30XEngine.buildOutputVolumeChange', () => {
  const engine = new FP30XEngine();

  it('keeps the DT1 01 00 02 13 address under the Output Volume name', () => {
    expect([...ADDR.OUTPUT_VOLUME]).toEqual([0x01, 0x00, 0x02, 0x13]);
  });

  it('produces the same bytes as the former volume builder', () => {
    expect(engine.buildOutputVolumeChange(100)).toEqual([
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      0x01, 0x00, 0x02, 0x13, 0x64, 0x06, 0xf7,
    ]);
    expect(engine.buildOutputVolumeChange(52)).toEqual([
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x28, 0x12,
      0x01, 0x00, 0x02, 0x13, 0x34, 0x36, 0xf7,
    ]);
  });

  it('clamps and rounds into 0-100', () => {
    expect(engine.buildOutputVolumeChange(150)[12]).toBe(100);
    expect(engine.buildOutputVolumeChange(-4)[12]).toBe(0);
    expect(engine.buildOutputVolumeChange(41.6)[12]).toBe(42);
  });
});
