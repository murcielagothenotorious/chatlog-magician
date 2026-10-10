import { describe, it, expect } from 'vitest';

// We duplicate the alignment functions here to unit test their algorithmic logic
function getLineAndOffset(text, index) {
  let currentOffset = 0;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineLengthWithNewline = lines[i].length + 1;
    if (index >= currentOffset && index < currentOffset + lineLengthWithNewline) {
      return {
        lineIdx: i,
        offset: index - currentOffset
      };
    }
    currentOffset += lineLengthWithNewline;
  }
  return {
    lineIdx: lines.length - 1,
    offset: lines[lines.length - 1].length
  };
}

function alignLines(raw, transformed) {
  const rawToTrans = new Array(raw.length + 1).fill(-1);
  
  let timestampLength = 0;
  const tsMatch = raw.match(/^\[\d{2}:\d{2}:\d{2}\] /);
  if (tsMatch) {
    timestampLength = tsMatch[0].length;
    for (let i = 0; i < timestampLength; i++) {
      rawToTrans[i] = 0;
    }
  }
  
  let r = timestampLength;
  let t = 0;
  
  while (r < raw.length && t < transformed.length) {
    const rc = raw[r];
    const tc = transformed[t];
    
    if (rc === tc) {
      rawToTrans[r] = t;
      r++;
      t++;
      continue;
    }
    
    const rcCode = rc.charCodeAt(0);
    if (tc === "'" && rcCode >= 8216 && rcCode <= 8219 && rcCode !== 39) {
      rawToTrans[r] = t;
      r++;
      t++;
      continue;
    }
    
    if (tc === '—') {
      if (r + 3 < raw.length && (
        (raw[r] === '.' && raw[r+1] === '.' && raw[r+2] === '.' && raw[r+3] === '-') ||
        (raw[r] === '-' && raw[r+1] === '.' && raw[r+2] === '.' && raw[r+3] === '.')
      )) {
        rawToTrans[r] = t;
        rawToTrans[r+1] = t;
        rawToTrans[r+2] = t;
        rawToTrans[r+3] = t;
        r += 4;
        t++;
        continue;
      }
    }
    
    r++;
  }
  
  while (r <= raw.length) {
    rawToTrans[r] = transformed.length;
    r++;
  }
  
  let lastVal = transformed.length;
  for (let i = raw.length; i >= 0; i--) {
    if (rawToTrans[i] !== -1) {
      lastVal = rawToTrans[i];
    } else {
      rawToTrans[i] = lastVal;
    }
  }
  
  return rawToTrans;
}

describe('getLineAndOffset', () => {
  it('correctly maps character index to line and offset', () => {
    const text = "line1\nline2\nline3";
    
    // "line1" indices: 0..4
    expect(getLineAndOffset(text, 0)).toEqual({ lineIdx: 0, offset: 0 });
    expect(getLineAndOffset(text, 4)).toEqual({ lineIdx: 0, offset: 4 });
    
    // "\n" index: 5
    expect(getLineAndOffset(text, 5)).toEqual({ lineIdx: 0, offset: 5 });
    
    // "line2" indices: 6..10
    expect(getLineAndOffset(text, 6)).toEqual({ lineIdx: 1, offset: 0 });
    expect(getLineAndOffset(text, 10)).toEqual({ lineIdx: 1, offset: 4 });
  });
});

describe('alignLines with timestamp removals', () => {
  it('maps correctly when timestamp is present', () => {
    const raw = "[12:34:56] [Birlik] John_Doe says: Hello!";
    const transformed = "[Birlik] John_Doe says: Hello!";
    
    const mapping = alignLines(raw, transformed);
    
    // The timestamp prefix "[12:34:56] " is 11 chars. All of them map to 0 in transformed.
    for (let i = 0; i < 11; i++) {
      expect(mapping[i]).toBe(0);
    }
    
    // The '[' of '[Birlik]' starts at index 11 in raw. It should map to index 0 of transformed.
    expect(mapping[11]).toBe(0);
    
    // The 'B' of '[Birlik]' is index 12 in raw. It maps to 1 in transformed.
    expect(mapping[12]).toBe(1);
    
    // The end of raw (index 41) maps to transformed.length (30)
    expect(mapping[raw.length]).toBe(transformed.length);
  });

  it('maps correctly when no timestamp is present', () => {
    const raw = "[Birlik] John_Doe says: Hello!";
    const transformed = "[Birlik] John_Doe says: Hello!";
    
    const mapping = alignLines(raw, transformed);
    
    // Direct mapping
    for (let i = 0; i <= raw.length; i++) {
      expect(mapping[i]).toBe(i);
    }
  });

  it('maps correctly with replaceDashes and replaceCurlyApostrophes', () => {
    const raw = "[12:34:56] John...-Doe’s car";
    const transformed = "John—Doe's car"; // ...- replaced by —, ’ replaced by '
    
    const mapping = alignLines(raw, transformed);
    
    // Timestamp [12:34:56] (11 chars) maps to 0
    expect(mapping[11]).toBe(0); // 'J' maps to 0
    expect(mapping[12]).toBe(1); // 'o' maps to 1
    
    // "John" ends at raw index 15.
    // "...-" starts at 15 and ends at 19. All four characters map to '—' which is transformed index 4.
    expect(mapping[15]).toBe(4);
    expect(mapping[16]).toBe(4);
    expect(mapping[17]).toBe(4);
    expect(mapping[18]).toBe(4);
    
    // "Doe" starts at 19 in raw, maps to 5 in transformed.
    expect(mapping[19]).toBe(5); // 'D'
    expect(mapping[22]).toBe(8); // 'e'
    
    // Curly apostrophe ’ is at index 22 in raw. Maps to ' at index 8 in transformed.
    expect(mapping[22]).toBe(8);
  });
});

function getTextOffset(container, targetNode, targetOffset) {
  let length = 0;
  let found = false;

  function walk(currentNode) {
    if (found) return;

    if (currentNode === targetNode && currentNode.nodeType === 3) { // Node.TEXT_NODE
      length += targetOffset;
      found = true;
      return;
    }

    if (currentNode.nodeType === 3) { // Node.TEXT_NODE
      length += currentNode.nodeValue.length;
    } else {
      for (let i = 0; i < currentNode.childNodes.length; i++) {
        if (currentNode === targetNode && i === targetOffset) {
          found = true;
          return;
        }
        walk(currentNode.childNodes[i]);
      }
      if (currentNode === targetNode && targetOffset >= currentNode.childNodes.length) {
        found = true;
      }
    }
  }

  walk(container);
  return length;
}

describe('getTextOffset', () => {
  it('correctly calculates character offset in a text node child', () => {
    const textNode1 = { nodeType: 3, nodeValue: "[!] " };
    const textNode2 = { nodeType: 3, nodeValue: "John says: Hello" };
    const span1 = { nodeType: 1, childNodes: [textNode1] };
    const span2 = { nodeType: 1, childNodes: [textNode2] };
    const div = { nodeType: 1, childNodes: [span1, span2] };

    // Select start of "John" (targetNode = textNode2, offset = 0)
    // The text content before is "[!] " (length 4).
    expect(getTextOffset(div, textNode2, 0)).toBe(4);

    // Select middle of "John" (offset = 2)
    expect(getTextOffset(div, textNode2, 2)).toBe(6);
  });

  it('correctly handles container boundary point offsets on elements', () => {
    const textNode1 = { nodeType: 3, nodeValue: "abc" };
    const textNode2 = { nodeType: 3, nodeValue: "def" };
    const span1 = { nodeType: 1, childNodes: [textNode1] };
    const span2 = { nodeType: 1, childNodes: [textNode2] };
    const div = { nodeType: 1, childNodes: [span1, span2] };

    // Boundary is div container at child index 1 (meaning it points before span2)
    // The text content before is span1 ("abc", length 3)
    expect(getTextOffset(div, div, 1)).toBe(3);

    // Boundary is div container at child index 0 (points before span1)
    expect(getTextOffset(div, div, 0)).toBe(0);

    // Boundary is div container at child index 2 (points after span2)
    expect(getTextOffset(div, div, 2)).toBe(6);
  });
});
