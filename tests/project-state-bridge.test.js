import { describe, expect, it, vi } from 'vitest';
import { createProject } from '../public/js/project-model.ts';
import {
  applyChatState,
  captureChatState,
  renderProjectState,
} from '../public/js/project-state-bridge.ts';

const CHAT_CONTROL_IDS = ['chatlogInput', 'font-label', 'lineLengthInput', 'lineSpacingInput'];

function fakeDocument(values = {}) {
  const nodes = new Map(Object.entries(values).map(([id, value]) => [id, { value }]));
  const lookups = [];

  return {
    getElementById(id) {
      lookups.push(id);
      return nodes.get(id) || null;
    },
    lookups,
    nodes,
  };
}

describe('legacy chat state bridge', () => {
  it('captures and reapplies current numeric chat controls', () => {
    const documentLike = fakeDocument({
      chatlogInput: 'Selam',
      'font-label': '12.5',
      lineLengthInput: '88',
      lineSpacingInput: '1.45',
    });

    const project = captureChatState(documentLike, createProject());

    expect(project.chat).toMatchObject({
      input: 'Selam',
      fontSize: 12.5,
      lineLength: 88,
      lineSpacing: 1.45,
    });

    for (const node of documentLike.nodes.values()) node.value = '';
    applyChatState(documentLike, project);

    expect(Object.fromEntries(documentLike.nodes)).toEqual({
      chatlogInput: { value: 'Selam' },
      'font-label': { value: 12.5 },
      lineLengthInput: { value: 88 },
      lineSpacingInput: { value: 1.45 },
    });
  });

  it('normalizes captured and applied numeric values through the project model', () => {
    const captured = captureChatState(
      fakeDocument({
        'font-label': '100',
        lineLengthInput: '-5',
        lineSpacingInput: '0.1',
      }),
      createProject({ chat: { input: 'Mevcut sohbet' } })
    );

    expect(captured.chat).toMatchObject({
      input: 'Mevcut sohbet',
      fontSize: 24,
      lineLength: 1,
      lineSpacing: 0.8,
    });

    const documentLike = fakeDocument({
      'font-label': '',
      lineLengthInput: '',
      lineSpacingInput: '',
    });
    const project = createProject();
    project.chat.fontSize = -1;
    project.chat.lineLength = 4000;
    project.chat.lineSpacing = 9;

    applyChatState(documentLike, project);

    expect(documentLike.nodes.get('font-label').value).toBe(8);
    expect(documentLike.nodes.get('lineLengthInput').value).toBe(1000);
    expect(documentLike.nodes.get('lineSpacingInput').value).toBe(3);
  });

  it('ignores missing controls and preserves their base project values', () => {
    const baseProject = createProject({
      chat: { input: 'Korunacak', fontSize: 15, lineLength: 90, lineSpacing: 1.8 },
    });
    const documentLike = fakeDocument({ chatlogInput: 'Guncel' });

    const captured = captureChatState(documentLike, baseProject);

    expect(captured.chat).toMatchObject({
      input: 'Guncel',
      fontSize: 15,
      lineLength: 90,
      lineSpacing: 1.8,
    });
    expect(() => applyChatState(fakeDocument(), captured)).not.toThrow();
    expect(baseProject.chat.input).toBe('Korunacak');
  });

  it('accesses only chat controls and leaves scene state unchanged', () => {
    const baseProject = createProject({
      canvas: { width: 1280, height: 720 },
      layers: [{ id: 'legacy-layer', assetId: 'asset-1' }],
      blocks: [{ id: 'chat-block', input: 'Blok' }],
    });
    const documentLike = fakeDocument({ chatlogInput: 'Yeni sohbet' });

    const captured = captureChatState(documentLike, baseProject);
    applyChatState(documentLike, captured);

    expect(documentLike.lookups).toEqual([...CHAT_CONTROL_IDS, ...CHAT_CONTROL_IDS]);
    expect(captured.canvas).toEqual(baseProject.canvas);
    expect(captured.layers).toEqual(baseProject.layers);
    expect(captured.blocks).toEqual(baseProject.blocks);
  });

  it('captures and applies the complete legacy parser appearance state', async () => {
    const parser = {
      captureProjectChatState: () => ({
        font: 'Georgia, serif',
        contrast: 'high',
        censorStyle: 'blur',
        hideSystemMessages: false,
        background: { enabled: true, color: '#123456', opacity: 0.5 },
      }),
      applyProjectChatState: vi.fn(async () => {}),
    };
    const documentLike = fakeDocument();
    documentLike.defaultView = { ChatlogParser: parser };

    const captured = captureChatState(documentLike, createProject());
    applyChatState(documentLike, captured);

    expect(captured.chat).toMatchObject({
      font: 'Georgia, serif',
      contrast: 'high',
      censorStyle: 'blur',
      hideSystemMessages: false,
      background: { enabled: true, color: '#123456', opacity: 0.5 },
    });
    expect(parser.applyProjectChatState).toHaveBeenCalledWith(captured.chat);
  });

  it('awaits both visible Chat and Canvas rendering', async () => {
    const order = [];
    const parser = {
      applyProjectChatState: vi.fn(async () => order.push('chat')),
    };
    const canvas = { refresh: vi.fn(async () => order.push('canvas')) };
    const documentLike = fakeDocument();
    documentLike.defaultView = { ChatlogParser: parser };

    await renderProjectState(documentLike, createProject(), { canvas });

    expect(order).toEqual(['chat', 'canvas']);
  });
});
