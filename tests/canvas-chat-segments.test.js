import { describe, expect, it, vi } from 'vitest';
import {
  formatChatBlock,
  formattedLinesFromOutput,
  segmentsFromElement,
} from '../public/js/canvas-chat-segments.ts';

function element({ className = '', style = {}, children = [], text = '' } = {}) {
  return {
    nodeType: 1,
    classList: { contains: (name) => className.split(/\s+/).includes(name) },
    className,
    style,
    childNodes: children.length > 0 ? children : [{ nodeType: 3, nodeValue: text }],
  };
}

describe('canvas chat segments', () => {
  it('captures rendered chat lines as detached plain color segments', () => {
    const renderedLines = [
      element({ className: 'generated white', text: 'John Doe says: Selam' }),
      element({
        className: 'generated',
        children: [
          element({ className: 'me', style: { fontStyle: 'italic' }, text: '* gülümser' }),
          element({ style: { color: '#123456' }, text: ' özel' }),
        ],
      }),
    ];
    const output = { querySelectorAll: () => renderedLines };

    expect(formattedLinesFromOutput(output)).toEqual([
      [
        {
          text: 'John Doe says: Selam',
          color: '#f1f1f1',
          italic: false,
          censored: false,
          remove: false,
          opsec: false,
        },
      ],
      [
        {
          text: '* gülümser',
          color: '#c2a3da',
          italic: true,
          censored: false,
          remove: false,
          opsec: false,
        },
        {
          text: ' özel',
          color: '#123456',
          italic: false,
          censored: false,
          remove: false,
          opsec: false,
        },
      ],
    ]);
  });

  it('uses a stored formatted snapshot without calling the parser', () => {
    const parser = { formatLineWithFilter: vi.fn() };
    const formattedLines = [
      [{ text: '* waves', color: '#c2a3da', italic: false, censored: false, remove: false }],
    ];

    expect(formatChatBlock({ input: '[12:00:00] * waves', formattedLines }, parser)).toEqual(
      formattedLines
    );
    expect(parser.formatLineWithFilter).not.toHaveBeenCalled();
  });

  it('preprocesses timestamps, dashes, and curly apostrophes for legacy blocks', () => {
    const parser = {
      removeTimestamps: vi.fn((line) => line.replace('[12:00:00] ', '')),
      replaceDashes: vi.fn((line) => line.replace('...-', '\u2014')),
      replaceCurlyApostrophes: vi.fn((line) => line.replace('\u2019', "'")),
      formatLineWithFilter: vi.fn((line) => `<span>${line}</span>`),
    };
    const parseMarkup = (markup) => [{ text: markup.replace(/<[^>]+>/g, '') }];

    expect(
      formatChatBlock({ input: '[12:00:00] * John...-\u2019s hand' }, parser, { parseMarkup })
    ).toEqual([
      [
        {
          text: "* John\u2014's hand",
          color: '#f1f1f1',
          italic: false,
          censored: false,
        },
      ],
    ]);
    expect(parser.formatLineWithFilter).toHaveBeenCalledWith("* John\u2014's hand");
  });

  it('converts parser HTML into plain draw segments without persisting HTML', () => {
    const parser = {
      formatLineWithFilter: vi.fn((line) => `<span class="white">${line}</span>`),
    };
    const parseMarkup = vi.fn((markup) => [
      {
        text: markup.replace(/<[^>]+>/g, ''),
        color: '#ffffff',
        italic: false,
        censored: false,
      },
    ]);
    const block = { input: 'Selam\n\nD\u00fcnya' };

    const lines = formatChatBlock(block, parser, { parseMarkup });

    expect(lines).toEqual([
      [{ text: 'Selam', color: '#ffffff', italic: false, censored: false }],
      [{ text: 'D\u00fcnya', color: '#ffffff', italic: false, censored: false }],
    ]);
    expect(parser.formatLineWithFilter).toHaveBeenCalledTimes(2);
    expect(parser.formatLineWithFilter).toHaveBeenNthCalledWith(1, 'Selam');
    expect(parser.formatLineWithFilter).toHaveBeenNthCalledWith(2, 'D\u00fcnya');
    expect(block).toEqual({ input: 'Selam\n\nD\u00fcnya' });
  });

  it('extracts inherited GTAW colors, inline styles, italics, and censor modes', () => {
    const root = element({
      className: 'white',
      children: [
        { nodeType: 3, nodeValue: 'Normal ' },
        element({ className: 'green', style: { fontStyle: 'italic' }, text: 'para' }),
        element({ className: 'censored-content blur-mode', text: ' gizli' }),
        element({ className: 'censored-content censored-remove', text: ' kald\u0131r' }),
        element({ style: { color: '#123456' }, text: ' \u00f6zel' }),
      ],
    });

    expect(segmentsFromElement(root)).toEqual([
      { text: 'Normal ', color: '#f1f1f1', italic: false, censored: false, remove: false, opsec: false },
      { text: 'para', color: '#56d64b', italic: true, censored: false, remove: false, opsec: false },
      { text: ' gizli', color: '#f1f1f1', italic: false, censored: true, remove: false, opsec: false },
      { text: ' kald\u0131r', color: '#f1f1f1', italic: false, censored: true, remove: true, opsec: false },
      { text: ' \u00f6zel', color: '#123456', italic: false, censored: false, remove: false, opsec: false },
    ]);
  });

  it('marks opsec-censored spans so the canvas renderer can draw redaction bars', () => {
    const root = element({
      className: 'white',
      children: [
        element({ className: 'censored-content censored-remove opsec-censored', text: 'gizli ad' }),
        element({ className: 'censored-content censored-remove', text: 'normal sans\u00fcr' }),
      ],
    });

    const segments = segmentsFromElement(root);
    expect(segments[0]).toMatchObject({ remove: true, opsec: true });
    expect(segments[1]).toMatchObject({ remove: true, opsec: false });
  });

  it('uses computed styles when a fixed class or inline style does not resolve a value', () => {
    const root = element({ children: [element({ className: 'custom', text: 'Hesaplanan' })] });
    const getStyle = vi.fn(() => ({ color: 'rgb(1, 2, 3)', fontStyle: 'italic' }));

    expect(segmentsFromElement(root, getStyle)).toEqual([
      {
        text: 'Hesaplanan',
        color: 'rgb(1, 2, 3)',
        italic: true,
        censored: false,
        remove: false,
        opsec: false,
      },
    ]);
  });

  it('rejects formatters that cannot produce detached plain segments', () => {
    expect(() => formatChatBlock({ input: 'Selam' }, {}, { parseMarkup: () => [] })).toThrow(
      /formatLineWithFilter/i
    );
    expect(() =>
      formatChatBlock(
        { input: 'Selam' },
        { formatLineWithFilter: () => '<span>Selam</span>' },
        { parseMarkup: () => null }
      )
    ).toThrow(/segments/i);
  });
});
