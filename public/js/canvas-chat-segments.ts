export interface ChatSegmentStyle {
  color: string;
  italic: boolean;
  censored: boolean;
  remove: boolean;
  opsec: boolean;
}

export interface ChatSegment extends ChatSegmentStyle {
  text: string;
}

export type ComputedStyleGetter = (element: unknown) => CSSStyleDeclaration | null;

const GTAW_COLORS: Readonly<Record<string, string>> = Object.freeze({
  me: '#c2a3da',
  ame: '#c2a3da',
  darkgrey: '#5a5a5b',
  grey: '#939799',
  lightgrey: '#c6c4c4',
  death: '#f00000',
  yellow: '#fbf724',
  green: '#56d64b',
  money: '#56d64b',
  orange: '#eda841',
  whisper: '#eda841',
  blue: '#3896f3',
  dodgerblue: '#1e90ff',
  white: '#f1f1f1',
  radioColor: '#d6cf8c',
  radioColor2: '#a19558',
  depColor: '#ccca15',
  vesseltraffic: '#33c1c9',
  toyou: '#ff00bc',
});

type DomRecord = Record<string, unknown>;

function classNames(element: unknown): string[] {
  const record = element as { className?: unknown; getAttribute?: unknown } | null | undefined;
  if (typeof record?.className === 'string') return record.className.split(/\s+/).filter(Boolean);
  if (typeof record?.getAttribute === 'function') {
    return String((record.getAttribute as (name: string) => unknown)('class') ?? '')
      .split(/\s+/)
      .filter(Boolean);
  }
  return [];
}

function inlineStyle(element: unknown, property: string): string {
  const record = (element ?? {}) as DomRecord;
  const style = record.style as
    | ({ [key: string]: unknown } & { getPropertyValue?: (property: string) => string })
    | null
    | undefined;
  if (!style) return '';
  return (style[property] ||
    style.getPropertyValue?.(property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)) ||
    '') as string;
}

function computedStyle(element: unknown, getStyle: unknown): CSSStyleDeclaration | null {
  const record = element as { nodeType?: unknown } | null | undefined;
  if (typeof getStyle !== 'function' || record?.nodeType !== 1) return null;
  try {
    return (getStyle as (target: unknown) => CSSStyleDeclaration)(element);
  } catch {
    return null;
  }
}

function styleForElement(
  element: unknown,
  inherited: ChatSegmentStyle,
  getStyle: unknown
): ChatSegmentStyle {
  const classes = classNames(element);
  const computed = computedStyle(element, getStyle);
  const classColor = classes.map((name) => GTAW_COLORS[name]).find(Boolean);
  const color = inlineStyle(element, 'color') || classColor || computed?.color || inherited.color;
  const fontStyle = inlineStyle(element, 'fontStyle') || computed?.fontStyle;
  const censored = inherited.censored || classes.includes('censored-content');
  const remove = inherited.remove || classes.includes('censored-remove');
  const opsec = inherited.opsec || classes.includes('opsec-censored');

  return {
    color: color || '#f1f1f1',
    italic: inherited.italic || fontStyle === 'italic' || fontStyle === 'oblique',
    censored,
    remove,
    opsec,
  };
}

export function segmentsFromElement(
  element: unknown,
  getStyle: unknown = globalThis.getComputedStyle
): ChatSegment[] {
  const segments: ChatSegment[] = [];

  function visit(node: unknown, inherited: ChatSegmentStyle): void {
    if (!node) return;
    const record = node as { nodeType?: unknown; nodeValue?: unknown; childNodes?: unknown };
    if (record.nodeType === 3) {
      const text = String(record.nodeValue ?? '');
      if (text.length > 0) segments.push({ text, ...inherited });
      return;
    }

    const style = record.nodeType === 1 ? styleForElement(node, inherited, getStyle) : inherited;
    for (const child of Array.from((record.childNodes ?? []) as ArrayLike<unknown>))
      visit(child, style);
  }

  visit(element, {
    color: '#f1f1f1',
    italic: false,
    censored: false,
    remove: false,
    opsec: false,
  });
  return segments;
}

export function formattedLinesFromOutput(
  output: unknown,
  getStyle: unknown = globalThis.getComputedStyle
): ChatSegment[][] {
  const record = output as { querySelectorAll?: unknown } | null | undefined;
  if (typeof record?.querySelectorAll !== 'function') return [];
  return Array.from(
    (record.querySelectorAll as (selector: string) => ArrayLike<Element>)('.generated')
  ).map((line) => segmentsFromElement(line, getStyle).map(plainSegment));
}

function parseDetachedMarkup(markup: unknown): ChatSegment[] {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error('A browser document or parseMarkup adapter is required');
  }
  const template = document.createElement('template');
  template.innerHTML = String(markup ?? '');
  return segmentsFromElement(template.content);
}

function plainSegment(segment: unknown): ChatSegment {
  const record = (segment ?? {}) as DomRecord;
  const plain: {
    text: string;
    color: string;
    italic: boolean;
    censored: boolean;
    remove?: boolean;
    opsec?: boolean;
  } = {
    text: String(record.text ?? ''),
    color: typeof record.color === 'string' ? record.color : '#f1f1f1',
    italic: record.italic === true,
    censored: record.censored === true,
  };
  if (segment && Object.prototype.hasOwnProperty.call(segment, 'remove')) {
    plain.remove = record.remove === true;
  }
  if (segment && Object.prototype.hasOwnProperty.call(segment, 'opsec')) {
    plain.opsec = record.opsec === true;
  }
  return plain as ChatSegment;
}

export function formatChatBlock(
  block: unknown,
  parser: unknown,
  { parseMarkup = parseDetachedMarkup }: { parseMarkup?: (markup: string) => unknown } = {}
): ChatSegment[][] {
  const record = (block ?? {}) as { formattedLines?: unknown; input?: unknown };
  if (Array.isArray(record.formattedLines) && record.formattedLines.length > 0) {
    return record.formattedLines.map((line) => (Array.isArray(line) ? line.map(plainSegment) : []));
  }
  const parserRecord = parser as { formatLineWithFilter?: unknown } | null | undefined;
  if (typeof parserRecord?.formatLineWithFilter !== 'function') {
    throw new TypeError('Chat parser must provide formatLineWithFilter');
  }
  if (typeof parseMarkup !== 'function') throw new TypeError('parseMarkup must be a function');

  return String(record.input ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const normalizedLine = [
        'removeTimestamps',
        'replaceDashes',
        'replaceCurlyApostrophes',
      ].reduce((value, method) => {
        const candidate = (parserRecord as Record<string, unknown>)[method];
        return typeof candidate === 'function'
          ? (candidate as (value: string) => string)(value)
          : value;
      }, line);
      const markup = (parserRecord.formatLineWithFilter as (value: string) => unknown)(
        normalizedLine
      );
      const segments = parseMarkup(String(markup ?? ''));
      if (!Array.isArray(segments)) throw new TypeError('parseMarkup must return plain segments');
      return segments.map(plainSegment);
    });
}
