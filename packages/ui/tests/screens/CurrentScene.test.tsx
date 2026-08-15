import {initTestStores} from '../utils/stores';
import {BASE_SCENE, sceneWith} from '../fixtures/setlists';
import {renderScene, stubPianoWithTones} from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  stubPianoWithTones([
    {id: 'a', name: 'Concert Piano'},
    {id: 'b', name: 'Strings'},
  ]);
});

describe('CurrentScene', () => {
  it('shows the label, voicing badge and tone', () => {
    const {container} = renderScene(sceneWith({voiceMode: 'single', rightToneId: 'a'}));
    expect(container.textContent).toContain('SINGLE');
    expect(container.textContent).toContain('Concert Piano');
  });

  it('shows both tones with role glyphs and the split point in split mode', () => {
    const {container} = renderScene(
      sceneWith({voiceMode: 'split', rightToneId: 'a', leftToneId: 'c', splitPoint: 54}),
    );
    expect(container.textContent).toContain('SPLIT');
    expect(container.textContent).toContain('▸');
    expect(container.textContent).toContain('◂');
    expect(container.textContent).toContain('F#3');
  });

  it('shows both tones in dual mode with no split point', () => {
    const {container} = renderScene(
      sceneWith({voiceMode: 'dual', rightToneId: 'a', dualTone2Id: 'b'}),
    );
    expect(container.textContent).toContain('DUAL');
    expect(container.textContent).toContain('Strings');
    expect(container.textContent).not.toContain('F#3');
  });

  it('renders free-text notes when present and omits the block when empty', () => {
    const withNotes = renderScene({...BASE_SCENE, notes: 'capo 2, half-time'});
    expect(withNotes.container.textContent).toContain('capo 2, half-time');

    const without = renderScene({...BASE_SCENE, notes: ''});
    expect(without.container.querySelector('[data-scene-notes]')).toBeNull();
  });

  it('marks the scene as modified only when told to', () => {
    expect(renderScene(BASE_SCENE, false).container.textContent).not.toContain('MODIFIED');
    expect(renderScene(BASE_SCENE, true).container.textContent).toContain('MODIFIED');
  });
});
