export function createFakeCanvas() {
  const drawCalls = [];
  const state = {};
  const contextTarget = {
    canvas: null,
    drawCalls,
    measureText(text) {
      drawCalls.push(['measureText', text]);
      return { width: String(text).length * 8 };
    },
  };
  const context = new Proxy(contextTarget, {
    get(target, property) {
      if (property in target) return target[property];
      if (property in state) return state[property];
      return (...args) => drawCalls.push([property, ...args]);
    },
    set(_target, property, value) {
      state[property] = value;
      drawCalls.push(['set', property, value]);
      return true;
    },
  });

  const canvas = {
    width: 0,
    height: 0,
    context,
    lastBlobRequest: null,
    getContext(type) {
      return type === '2d' ? context : null;
    },
    toBlob(callback, mimeType, quality) {
      this.lastBlobRequest = [mimeType, quality];
      callback(new globalThis.Blob(['canvas'], { type: mimeType }));
    },
  };
  contextTarget.canvas = canvas;
  return canvas;
}

export function createFakeAssets(records = {}) {
  return {
    get(assetId) {
      return records[assetId] ?? null;
    },
  };
}
