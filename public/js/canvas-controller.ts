import { createCanvasAssetRegistry } from './canvas-asset-registry.js';
import { formatChatBlock, formattedLinesFromOutput } from './canvas-chat-segments.js';
import { canvasCompositionLayout, createCanvasRenderer } from './canvas-renderer.js';
import {
  addSceneItem,
  createChatBlock,
  createImageLayer,
  moveSceneItem,
  removeSceneItem,
  selectSceneItem,
  updateSceneItem,
} from './canvas-scene.js';

const MIN_ITEM_SIZE = 24;
const SNAP_TOLERANCE = 5;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

const CONTROL_IDS = [
  'modeChat',
  'modeCanvas',
  'canvasBackgroundInput',
  'canvasImageInput',
  'canvasBackgroundUpload',
  'canvasImageUpload',
  'canvasAddChat',
  'canvasUndo',
  'canvasRedo',
  'canvasClear',
  'canvasBackgroundColor',
  'canvasBackgroundOpacity',
  'canvasBackgroundBlur',
  'canvasBackgroundGrain',
  'canvasAddRedactionBox',
  'canvasDetectFaces',
  'canvasComposition',
  'canvasPaddingX',
  'canvasPaddingY',
  'canvasFitMode',
  'canvasWidth',
  'canvasHeight',
  'canvasExportFormat',
  'canvasJpegQualityField',
  'canvasJpegQuality',
  'canvasCopy',
  'canvasDownload',
  'canvasChatDialog',
  'canvasChatForm',
  'canvasChatName',
  'canvasChatInput',
  'canvasChatError',
  'canvasChatCancel',
  'canvasChatSubmit',
];

function iconButton(documentLike, icon, label, action, layerId, pressed?) {
  const button = documentLike.createElement('button');
  button.type = 'button';
  button.className = 'canvas-icon-button';
  button.title = label;
  button.dataset.canvasAction = action;
  button.dataset.layerId = layerId;
  button.setAttribute('aria-label', label);
  if (typeof pressed === 'boolean') button.setAttribute('aria-pressed', String(pressed));
  const iconElement = documentLike.createElement('i');
  iconElement.className = `fas ${icon}`;
  iconElement.setAttribute('aria-hidden', 'true');
  button.append(iconElement);
  return button;
}

function readiness(documentLike) {
  return documentLike.body?.dataset?.canvasReady === 'true';
}

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function exportFilename(format, date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const timestamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('-');
  return `chatlog-canvas-${timestamp}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}

export function createCanvasController({
  document,
  project,
  assetRegistry,
  renderer,
  captureFormattedChat = () => [],
  formatChatInput = () => [],
}: any) {
  if (!document || !project || !assetRegistry || !renderer) {
    throw new TypeError('Canvas controller dependencies are required');
  }

  const elements = Object.fromEntries(
    [
      ...CONTROL_IDS,
      'output',
      'canvasWorkspace',
      'canvasViewport',
      'canvasStage',
      'canvasPreview',
      'canvasSelection',
      'canvasGuides',
      'canvasLayerList',
      'canvasStatus',
      'canvasStatusMeta',
    ].map((id) => [id, document.getElementById(id)])
  );
  const listeners = [];
  let selectedId = null;
  let destroyed = false;
  let mode = 'chat';
  let zoom = 1;
  let gesture = null;
  let previewProject = null;
  let animationFrame = null;
  let renderPending = false;
  let renderVersion = 0;
  let pan = null;
  let spacePressed = false;
  let exportBusy = false;

  function listen(element, type, handler) {
    if (!element) return;
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  }

  function setStatus(message) {
    if (elements.canvasStatus) elements.canvasStatus.textContent = message;
  }

  function getProject() {
    return project.getSnapshot();
  }

  function sceneItems(snapshot = getProject()) {
    const inTopmostOrder = (items) =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.visible !== false)
        .sort(
          (left, right) =>
            (Number(right.item.zIndex) || 0) - (Number(left.item.zIndex) || 0) ||
            right.index - left.index
        )
        .map(({ item }) => item);
    const redactionItems = (snapshot.redactionBoxes || [])
      .filter((b) => b.visible !== false)
      .map((b) => ({
        id: b.id,
        kind: 'redaction',
        transform: { x: b.x, y: b.y, width: b.width, height: b.height, rotation: 0 },
        visible: true,
        locked: false,
      }));
    return [
      ...inTopmostOrder(snapshot.blocks),
      ...redactionItems,
      ...inTopmostOrder(snapshot.layers),
    ];
  }

  function layoutFor(snapshot = getProject()) {
    return canvasCompositionLayout(snapshot.canvas, snapshot.blocks);
  }

  function originFor(item, layout) {
    return item.kind === 'chat' ? layout.chatOrigin : layout.sceneOrigin;
  }

  function itemContainsPoint(item, point, layout) {
    if (!item || item.locked || item.visible === false) return false;
    const { x, y, width, height, rotation = 0 } = item.transform;
    const scale = item.kind === 'chat' ? Number(item.scale) || 1 : 1;
    const origin = originFor(item, layout);
    const boxWidth = width * scale;
    const boxHeight = height * scale;
    const boxX = origin.x + x;
    const boxY = origin.y + y;

    let testX = point.x;
    let testY = point.y;

    if (rotation) {
      const cx = boxX + boxWidth / 2;
      const cy = boxY + boxHeight / 2;
      const rad = (-rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = point.x - cx;
      const dy = point.y - cy;
      testX = cx + dx * cos - dy * sin;
      testY = cy + dx * sin + dy * cos;
    }

    return testX >= boxX && testX <= boxX + boxWidth && testY >= boxY && testY <= boxY + boxHeight;
  }

  function itemAtPoint(point) {
    const snapshot = getProject();
    const layout = layoutFor(snapshot);
    return sceneItems(snapshot).find((item) => itemContainsPoint(item, point, layout)) ?? null;
  }

  function projectPoint(input, y?) {
    if (typeof input === 'number') return { x: input, y: Number(y) || 0 };
    if (Number.isFinite(input?.x) && Number.isFinite(input?.y)) {
      return { x: input.x, y: input.y };
    }
    const rect = elements.canvasStage?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    return {
      x: ((Number(input?.clientX) || 0) - rect.left) / zoom,
      y: ((Number(input?.clientY) || 0) - rect.top) / zoom,
    };
  }

  function updateStageSize(snapshot = getProject()) {
    if (!elements.canvasStage) return;
    const { width, height } = layoutFor(snapshot);
    elements.canvasStage.style.width = `${width * zoom}px`;
    elements.canvasStage.style.height = `${height * zoom}px`;
  }

  function renderSelection(snapshot = previewProject ?? getProject()) {
    if (!elements.canvasSelection) return;
    const item =
      selectedId && selectedId !== 'background' ? selectSceneItem(snapshot, selectedId) : null;
    elements.canvasSelection.hidden = !item;
    if (!item) return;
    const origin = originFor(item, layoutFor(snapshot));
    const { x, y, width, height, rotation = 0 } = item.transform;
    const scale = item.kind === 'chat' ? Number(item.scale) || 1 : 1;
    Object.assign(elements.canvasSelection.style, {
      left: `${(origin.x + x) * zoom}px`,
      top: `${(origin.y + y) * zoom}px`,
      width: `${width * scale * zoom}px`,
      height: `${height * scale * zoom}px`,
      transform: rotation ? `rotate(${rotation}deg)` : '',
      transformOrigin: 'center center',
    });
  }

  function renderGuides(vertical = null, horizontal = null) {
    if (!elements.canvasGuides) return;
    const guides = [];
    for (const [position, className, property] of [
      [vertical, 'canvas-guide canvas-guide--vertical', 'left'],
      [horizontal, 'canvas-guide canvas-guide--horizontal', 'top'],
    ]) {
      if (position === null) continue;
      const guide = document.createElement('span');
      guide.className = className;
      guide.style[property] = `${position * zoom}px`;
      guides.push(guide);
    }
    elements.canvasGuides.replaceChildren(...guides);
  }

  function setMode(nextMode) {
    mode = nextMode;
    const canvasActive = mode === 'canvas';
    if (document.body?.dataset) document.body.dataset.canvasActive = String(canvasActive);
    if (elements.output) elements.output.hidden = canvasActive;
    if (elements.canvasWorkspace) elements.canvasWorkspace.hidden = !canvasActive;
    elements.modeChat?.classList.toggle('is-active', !canvasActive);
    elements.modeCanvas?.classList.toggle('is-active', canvasActive);
    elements.modeChat?.setAttribute('aria-pressed', String(!canvasActive));
    elements.modeCanvas?.setAttribute('aria-pressed', String(canvasActive));
  }

  function updateHistoryControls() {
    if (elements.canvasUndo) elements.canvasUndo.disabled = !project.canUndo?.();
    if (elements.canvasRedo) elements.canvasRedo.disabled = !project.canRedo?.();
  }

  function setControlValue(id, value) {
    if (elements[id]) elements[id].value = String(value);
  }

  function syncControls(snapshot = getProject()) {
    const { canvas, export: exportOptions } = snapshot;
    setControlValue('canvasBackgroundColor', canvas.background.color || '#000000');
    setControlValue('canvasBackgroundOpacity', canvas.background.opacity ?? 1);
    setControlValue('canvasBackgroundBlur', canvas.background.blur ?? 0);
    setControlValue('canvasBackgroundGrain', canvas.background.grain ?? 0);
    setControlValue('canvasComposition', canvas.composition);
    setControlValue('canvasPaddingX', canvas.padding.x);
    setControlValue('canvasPaddingY', canvas.padding.y);
    setControlValue('canvasFitMode', canvas.fitMode);
    setControlValue('canvasWidth', canvas.width);
    setControlValue('canvasHeight', canvas.height);
    setControlValue('canvasExportFormat', exportOptions.format);
    setControlValue('canvasJpegQuality', exportOptions.jpegQuality);
    if (elements.canvasJpegQualityField) {
      elements.canvasJpegQualityField.hidden = exportOptions.format !== 'jpeg';
    }
    if (elements.canvasCopy) elements.canvasCopy.disabled = exportBusy;
    if (elements.canvasDownload) elements.canvasDownload.disabled = exportBusy;
    updateStatusMeta(snapshot);
  }

  function updateStatusMeta(snapshot = getProject()) {
    if (!elements.canvasStatusMeta) return;
    const format = snapshot.export.format === 'jpeg' ? 'JPG' : 'PNG';
    elements.canvasStatusMeta.textContent = `${format} · %${Math.round(zoom * 100)}`;
  }

  function itemRow(item) {
    const row = document.createElement('div');
    row.className = 'canvas-layer-row';
    row.dataset.layerId = item.id;
    row.classList.toggle('is-selected', selectedId === item.id);

    const name = document.createElement('span');
    name.className = 'canvas-layer-name';
    name.textContent = item.name;
    name.title = item.name;

    const actions = document.createElement('div');
    actions.className = 'canvas-layer-actions';
    const opacity = document.createElement('input');
    opacity.type = 'range';
    opacity.min = '0';
    opacity.max = '1';
    opacity.step = '0.05';
    opacity.value = String(item.opacity ?? 1);
    opacity.className = 'canvas-layer-opacity';
    opacity.dataset.canvasAction = 'opacity';
    opacity.dataset.layerId = item.id;
    opacity.title = 'Katman opaklığı';
    opacity.setAttribute('aria-label', `${item.name} opaklığı`);
    opacity.disabled = item.locked;
    const backward = iconButton(document, 'fa-arrow-down', 'Arkaya al', 'backward', item.id);
    const forward = iconButton(document, 'fa-arrow-up', 'Öne al', 'forward', item.id);
    backward.disabled = item.locked;
    forward.disabled = item.locked;
    actions.append(
      iconButton(
        document,
        'fa-arrow-pointer',
        'Katmanı seç',
        'select',
        item.id,
        selectedId === item.id
      ),
      iconButton(
        document,
        item.visible === false ? 'fa-eye-slash' : 'fa-eye',
        item.visible === false ? 'Göster' : 'Gizle',
        'visibility',
        item.id
      ),
      iconButton(
        document,
        item.locked ? 'fa-lock' : 'fa-lock-open',
        item.locked ? 'Kilidi aç' : 'Kilitle',
        'lock',
        item.id
      ),
      backward,
      forward,
      opacity,
      iconButton(document, 'fa-trash', 'Sil', 'delete', item.id)
    );
    row.append(name, actions);
    return row;
  }

  function redactionBoxRow(box, index) {
    const row = document.createElement('div');
    row.className = 'canvas-layer-row canvas-layer-row--redaction';
    row.classList.toggle('is-selected', selectedId === box.id);
    const name = document.createElement('span');
    name.className = 'canvas-layer-name';
    name.textContent = `Sansür Kutusu ${index + 1}`;
    const actions = document.createElement('div');
    actions.className = 'canvas-layer-actions';
    actions.append(
      iconButton(
        document,
        'fa-arrow-pointer',
        'Sansür kutusunu seç',
        'select',
        box.id,
        selectedId === box.id
      ),
      iconButton(
        document,
        box.visible === false ? 'fa-eye-slash' : 'fa-eye',
        box.visible === false ? 'Göster' : 'Gizle',
        'visibility',
        box.id
      ),
      iconButton(document, 'fa-trash', 'Sil', 'delete', box.id)
    );
    row.append(name, actions);
    return row;
  }

  function renderLayers() {
    if (!elements.canvasLayerList) return;
    const snapshot = getProject();
    const background = document.createElement('div');
    background.className = 'canvas-layer-row canvas-layer-row--background';
    background.classList.toggle('is-selected', selectedId === 'background');
    const label = document.createElement('span');
    label.className = 'canvas-layer-name';
    label.textContent = 'Arka Plan';
    const actions = document.createElement('div');
    actions.className = 'canvas-layer-actions';
    actions.append(
      iconButton(
        document,
        'fa-arrow-pointer',
        'Arka planı seç',
        'select',
        'background',
        selectedId === 'background'
      ),
      iconButton(
        document,
        snapshot.canvas.background.visible === false ? 'fa-eye-slash' : 'fa-eye',
        snapshot.canvas.background.visible === false ? 'Göster' : 'Gizle',
        'visibility',
        'background'
      ),
      iconButton(
        document,
        snapshot.canvas.background.locked ? 'fa-lock' : 'fa-lock-open',
        snapshot.canvas.background.locked ? 'Kilidi aç' : 'Kilitle',
        'lock',
        'background'
      ),
      iconButton(document, 'fa-trash', 'Arka planı sil', 'delete', 'background')
    );
    background.append(label, actions);
    elements.canvasLayerList.replaceChildren(
      background,
      ...snapshot.layers.map(itemRow),
      ...(snapshot.redactionBoxes || []).map(redactionBoxRow),
      ...snapshot.blocks.map(itemRow)
    );
  }

  function handleLayerAction(event) {
    const button = event.target.closest?.('[data-canvas-action]');
    if (!button) return;
    const { canvasAction: action, layerId } = button.dataset;
    if (layerId === 'background') {
      if (action === 'select') selectBackground();
      if (action === 'visibility') toggleBackgroundVisibility();
      if (action === 'lock') toggleBackgroundLock();
      if (action === 'delete') clearBackground();
      return;
    }
    if (action === 'select') select(layerId);
    if (action === 'visibility') toggleVisibility(layerId);
    if (action === 'lock') toggleLock(layerId);
    if (action === 'backward' || action === 'forward') reorder(layerId, action);
    if (action === 'delete') remove(layerId);
  }

  function layerOpacityTarget(event) {
    const control = event.target.closest?.('[data-canvas-action]');
    if (!control || control.dataset.canvasAction !== 'opacity') return null;
    const item = selectSceneItem(getProject(), control.dataset.layerId);
    if (!item || item.locked) return null;
    return { item, value: boundedNumber(control.value, item.opacity ?? 1, 0, 1) };
  }

  function handleLayerOpacityInput(event) {
    const target = layerOpacityTarget(event);
    if (!target) return;
    scheduleGestureRender(updateSceneItem(getProject(), target.item.id, { opacity: target.value }));
  }

  function handleLayerChange(event) {
    const target = layerOpacityTarget(event);
    if (!target) return;
    previewProject = null;
    commit((draft) =>
      Object.assign(
        draft,
        updateSceneItem(draft, target.item.id, {
          opacity: target.value,
        })
      )
    );
  }

  async function render(snapshotOverride?, propagateError = false) {
    if (destroyed || !elements.canvasPreview) return null;
    const thisVersion = ++renderVersion;
    try {
      const snapshot = snapshotOverride ?? getProject();
      const result = await renderer.render(snapshot, elements.canvasPreview);
      if (thisVersion !== renderVersion || destroyed) return result;
      const layout = layoutFor(snapshot);
      setStatus(`${layout.width} × ${layout.height} px`);
      return result;
    } catch (error) {
      if (thisVersion === renderVersion && !destroyed) {
        setStatus(error?.message || 'Canvas oluşturulamadı');
      }
      if (propagateError) throw error;
      return null;
    }
  }

  function refresh() {
    syncControls();
    renderLayers();
    updateHistoryControls();
    updateStageSize();
    renderSelection();
    renderer.clearCache?.();
    return render(undefined, true);
  }

  function commit(mutator) {
    project.commit(mutator);
    void refresh().catch(() => {});
    return getProject();
  }

  function commitControl(mutator) {
    if (!destroyed) commit(mutator);
  }

  async function exportCanvas(action) {
    if (destroyed || exportBusy) return null;
    exportBusy = true;
    syncControls();
    const snapshot = getProject();
    try {
      const blob = await renderer.toBlob(snapshot);
      const windowLike = document.defaultView ?? globalThis;
      if (action === 'copy') {
        const ClipboardItemConstructor = windowLike.ClipboardItem ?? globalThis.ClipboardItem;
        const clipboard = windowLike.navigator?.clipboard ?? globalThis.navigator?.clipboard;
        if (!ClipboardItemConstructor || typeof clipboard?.write !== 'function') {
          throw new Error('Clipboard API unavailable');
        }
        await clipboard.write([new ClipboardItemConstructor({ [blob.type]: blob })]);
        if (!destroyed) setStatus('Canvas görseli panoya kopyalandı.');
      } else {
        const saveAs = windowLike.saveAs ?? globalThis.saveAs;
        if (typeof saveAs !== 'function') throw new Error('Download API unavailable');
        saveAs(blob, exportFilename(snapshot.export.format));
        if (!destroyed) setStatus('Canvas görseli indirildi.');
      }
      return blob;
    } catch {
      if (!destroyed) {
        setStatus(
          action === 'copy'
            ? 'Kopyalama başarısız. Pano iznini kontrol edip tekrar deneyin.'
            : 'İndirme başarısız. Tarayıcı indirme izinlerini kontrol edip tekrar deneyin.'
        );
      }
      return null;
    } finally {
      exportBusy = false;
      if (!destroyed) syncControls();
    }
  }

  function toBlob(snapshot = getProject()) {
    return renderer.toBlob(snapshot);
  }

  function prepareAsset(blob, metadata) {
    return assetRegistry.prepareWithId(blob, metadata);
  }

  function prepareReplacementAsset(blob, metadata) {
    return assetRegistry.prepareReplacementWithId(blob, metadata);
  }

  function persistentAsset(assetId) {
    const metadata = assetRegistry.metadata?.(assetId);
    const record = assetRegistry.get?.(assetId);
    return metadata && record?.blob ? { ...metadata, blob: record.blob } : undefined;
  }

  function listAssets() {
    return (assetRegistry.listMetadata?.() ?? [])
      .map(({ id }) => persistentAsset(id))
      .filter(Boolean);
  }

  async function enter() {
    if (destroyed || !readiness(document)) return getProject();
    project.captureCurrentChat?.();
    const formattedLines = captureFormattedChatDrained();
    const snapshot = getProject();
    const mainBlock =
      snapshot.blocks.find((block) => block.source === 'main-chat') ??
      snapshot.blocks.find((block) => !block.source);
    project.commit((draft) => {
      if (mainBlock) {
        Object.assign(
          draft,
          updateSceneItem(draft, mainBlock.id, {
            input: draft.chat.input,
            source: 'main-chat',
            formattedLines,
          })
        );
      } else {
        const inset = 24;
        Object.assign(
          draft,
          addSceneItem(
            draft,
            createChatBlock({
              name: 'Ana Sohbet',
              input: draft.chat.input,
              source: 'main-chat',
              formattedLines,
              transform: {
                x: inset,
                y: inset,
                width: Math.max(1, draft.canvas.width - inset * 2),
                height: Math.max(1, draft.canvas.height - inset * 2),
              },
            })
          )
        );
      }
    });
    setMode('canvas');
    await refresh();
    return getProject();
  }

  function exit() {
    if (!destroyed) {
      spacePressed = false;
      setMode('chat');
    }
    return getProject();
  }

  function select(id) {
    const item =
      typeof id === 'string' ? selectSceneItem(getProject(), id) : itemAtPoint(projectPoint(id));
    selectedId = item?.id ?? null;
    renderLayers();
    renderSelection();
    return selectedId;
  }

  function getSelection() {
    return selectedId;
  }

  function selectedUnlockedItem(id = selectedId) {
    const item = id ? selectSceneItem(getProject(), id) : null;
    return item && !item.locked ? item : null;
  }

  function scheduleGestureRender(snapshot) {
    previewProject = snapshot;
    updateStageSize(snapshot);
    renderSelection(snapshot);
    if (renderPending || animationFrame !== null) return;
    const requestFrame =
      document.defaultView?.requestAnimationFrame ?? globalThis.requestAnimationFrame;
    const callback = async () => {
      animationFrame = null;
      if (!destroyed && previewProject) {
        renderPending = true;
        try {
          await render(previewProject);
        } finally {
          renderPending = false;
        }
      }
    };
    animationFrame =
      typeof requestFrame === 'function' ? requestFrame(callback) : setTimeout(callback, 0);
  }

  function beginGesture(type, id, input: any = {}) {
    const item = selectedUnlockedItem(id);
    if (!item || gesture) return false;
    selectedId = item.id;
    gesture = {
      type,
      id: item.id,
      pointerId: input.pointerId,
      start: { clientX: Number(input.clientX) || 0, clientY: Number(input.clientY) || 0 },
      original: { ...item.transform },
      transform: { ...item.transform },
      changed: false,
    };
    try {
      if (input.pointerId !== undefined) {
        elements.canvasStage?.setPointerCapture?.(input.pointerId);
      }
    } catch {
      /* intentionally empty */
    }
    renderLayers();
    renderSelection();
    return true;
  }

  function beginMove(id, input) {
    return beginGesture('move', id, input);
  }

  function beginResize(id, input) {
    return beginGesture('resize', id, input);
  }

  function outputBounds(item, layout) {
    const origin = originFor(item, layout);
    const scale = item.kind === 'chat' ? Number(item.scale) || 1 : 1;
    return {
      x: origin.x + item.transform.x,
      y: origin.y + item.transform.y,
      width: item.transform.width * scale,
      height: item.transform.height * scale,
    };
  }

  function peersForGesture(snapshot, layout) {
    return sceneItems(snapshot)
      .filter((item) => item.id !== gesture.id)
      .map((item) => outputBounds(item, layout));
  }

  function alignmentTargets(axis, canvas, origin, peers) {
    const sizeKey = axis === 'x' ? 'width' : 'height';
    const canvasSize = canvas[sizeKey];
    const contentOrigin = origin[axis];
    return [
      contentOrigin,
      contentOrigin + canvasSize / 2,
      contentOrigin + canvasSize,
      ...peers.flatMap((peer) => [
        peer[axis],
        peer[axis] + peer[sizeKey] / 2,
        peer[axis] + peer[sizeKey],
      ]),
    ];
  }

  function snapAxis(position, size, targets) {
    let snapped = position;
    let guide = null;
    let nearestDistance = SNAP_TOLERANCE + 1;
    for (const target of targets) {
      for (const offset of [0, size / 2, size]) {
        const candidate = target - offset;
        const distance = Math.abs(candidate - position);
        if (distance <= SNAP_TOLERANCE && distance < nearestDistance) {
          snapped = candidate;
          guide = target;
          nearestDistance = distance;
        }
      }
    }
    return { position: snapped, guide };
  }

  function previewTransform(nextTransform, guides: any = {}) {
    gesture.transform = nextTransform;
    gesture.changed = Object.keys(nextTransform).some(
      (key) => nextTransform[key] !== gesture.original[key]
    );
    const next = updateSceneItem(getProject(), gesture.id, { transform: nextTransform });
    renderGuides(guides.vertical ?? null, guides.horizontal ?? null);
    scheduleGestureRender(next);
    return nextTransform;
  }

  function move(input) {
    if (gesture?.type !== 'move') return false;
    const deltaX = ((Number(input?.clientX) || 0) - gesture.start.clientX) / zoom;
    const deltaY = ((Number(input?.clientY) || 0) - gesture.start.clientY) / zoom;
    const unsnapped = {
      ...gesture.original,
      x: gesture.original.x + deltaX,
      y: gesture.original.y + deltaY,
    };
    const snapshot = getProject();
    const canvas = snapshot.canvas;
    const item = selectSceneItem(snapshot, gesture.id);
    const layout = layoutFor(snapshot);
    const origin = originFor(item, layout);
    const peers = peersForGesture(snapshot, layout);
    const horizontal = snapAxis(
      origin.x + unsnapped.x,
      unsnapped.width,
      alignmentTargets('x', canvas, origin, peers)
    );
    const vertical = snapAxis(
      origin.y + unsnapped.y,
      unsnapped.height,
      alignmentTargets('y', canvas, origin, peers)
    );
    return previewTransform(
      {
        ...unsnapped,
        x: horizontal.position - origin.x,
        y: vertical.position - origin.y,
      },
      {
        vertical: horizontal.guide,
        horizontal: vertical.guide,
      }
    );
  }

  function snapEdge(value, targets) {
    let nearest = value;
    let distance = SNAP_TOLERANCE + 1;
    for (const target of targets) {
      const candidateDistance = Math.abs(target - value);
      if (candidateDistance <= SNAP_TOLERANCE && candidateDistance < distance) {
        nearest = target;
        distance = candidateDistance;
      }
    }
    return nearest;
  }

  function resize(input) {
    if (gesture?.type !== 'resize') return false;
    const deltaX = ((Number(input?.clientX) || 0) - gesture.start.clientX) / zoom;
    const deltaY = ((Number(input?.clientY) || 0) - gesture.start.clientY) / zoom;
    let newWidth = Math.max(MIN_ITEM_SIZE, gesture.original.width + deltaX);
    let newHeight = Math.max(MIN_ITEM_SIZE, gesture.original.height + deltaY);

    if (input?.shiftKey && gesture.original.width > 0 && gesture.original.height > 0) {
      const ratio = gesture.original.width / gesture.original.height;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        newHeight = Math.max(MIN_ITEM_SIZE, newWidth / ratio);
      } else {
        newWidth = Math.max(MIN_ITEM_SIZE, newHeight * ratio);
      }
    }

    const snapshot = getProject();
    const canvas = snapshot.canvas;
    const item = selectSceneItem(snapshot, gesture.id);
    const layout = layoutFor(snapshot);
    const origin = originFor(item, layout);
    const peers = peersForGesture(snapshot, layout);
    const unsnappedRight = origin.x + gesture.original.x + newWidth;
    const unsnappedBottom = origin.y + gesture.original.y + newHeight;
    const right = input?.shiftKey
      ? unsnappedRight
      : snapEdge(unsnappedRight, alignmentTargets('x', canvas, origin, peers));
    const bottom = input?.shiftKey
      ? unsnappedBottom
      : snapEdge(unsnappedBottom, alignmentTargets('y', canvas, origin, peers));
    return previewTransform(
      {
        ...gesture.original,
        width: Math.max(MIN_ITEM_SIZE, right - origin.x - gesture.original.x),
        height: Math.max(MIN_ITEM_SIZE, bottom - origin.y - gesture.original.y),
      },
      {
        vertical: right !== unsnappedRight ? right : null,
        horizontal: bottom !== unsnappedBottom ? bottom : null,
      }
    );
  }

  function endGesture(type, input: any = {}, commitChange = true) {
    if (gesture?.type !== type) return false;
    const completed = gesture;
    gesture = null;
    try {
      elements.canvasStage?.releasePointerCapture?.(input.pointerId ?? completed.pointerId);
    } catch {
      /* intentionally empty */
    }
    previewProject = null;
    renderGuides();
    if (commitChange && completed.changed) {
      commit((draft) =>
        Object.assign(
          draft,
          updateSceneItem(draft, completed.id, { transform: completed.transform })
        )
      );
    } else {
      updateStageSize();
      renderSelection();
      if (completed.changed) void render();
    }
    return completed.changed;
  }

  function endMove(input) {
    return endGesture('move', input);
  }

  function endResize(input) {
    return endGesture('resize', input);
  }

  function nudge(direction, y, shiftKey = false) {
    const item = selectedUnlockedItem();
    if (!item) return false;
    let deltaX = 0;
    let deltaY = 0;
    const amount = shiftKey ? 10 : 1;
    if (typeof direction === 'number') {
      deltaX = direction;
      deltaY = Number(y) || 0;
    } else {
      if (direction === 'ArrowLeft') deltaX = -amount;
      if (direction === 'ArrowRight') deltaX = amount;
      if (direction === 'ArrowUp') deltaY = -amount;
      if (direction === 'ArrowDown') deltaY = amount;
    }
    if (deltaX === 0 && deltaY === 0) return false;
    commit((draft) =>
      Object.assign(
        draft,
        updateSceneItem(draft, item.id, {
          transform: { x: item.transform.x + deltaX, y: item.transform.y + deltaY },
        })
      )
    );
    return true;
  }

  function setZoom(value) {
    const number = Number(value);
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(number) ? number : zoom));
    updateStageSize();
    renderSelection();
    updateStatusMeta();
    return zoom;
  }

  function getZoom() {
    return zoom;
  }

  function fitViewport() {
    if (!elements.canvasViewport) return setZoom(1);
    const { width, height } = layoutFor();
    let styles: any = {};
    try {
      styles = document.defaultView?.getComputedStyle?.(elements.canvasViewport) ?? {};
    } catch {
      styles = {};
    }
    const padding = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const availableWidth = Math.max(
      0,
      elements.canvasViewport.clientWidth -
        padding(styles.paddingLeft) -
        padding(styles.paddingRight)
    );
    const availableHeight = Math.max(
      0,
      elements.canvasViewport.clientHeight -
        padding(styles.paddingTop) -
        padding(styles.paddingBottom)
    );
    return setZoom(Math.min(availableWidth / width, availableHeight / height));
  }

  function selectBackground() {
    selectedId = 'background';
    renderLayers();
    return selectedId;
  }

  function toggleBackgroundVisibility() {
    if (!backgroundEditable()) return;
    commit((draft) => {
      draft.canvas.background.visible = draft.canvas.background.visible === false;
    });
  }

  function backgroundEditable() {
    if (getProject().canvas.background.locked) {
      setStatus('Önce arka planın kilidini açın.');
      return false;
    }
    return true;
  }

  function toggleBackgroundLock() {
    commit((draft) => {
      draft.canvas.background.locked = !draft.canvas.background.locked;
    });
  }

  function toggleLock(id) {
    const item = selectSceneItem(getProject(), id);
    if (item)
      commit((draft) => Object.assign(draft, updateSceneItem(draft, id, { locked: !item.locked })));
  }

  function toggleVisibility(id) {
    const item = selectSceneItem(getProject(), id);
    if (item)
      commit((draft) =>
        Object.assign(draft, updateSceneItem(draft, id, { visible: !item.visible }))
      );
  }

  function reorder(id, direction) {
    const item = selectSceneItem(getProject(), id);
    if (!item || item.locked) return;
    commit((draft) => Object.assign(draft, moveSceneItem(draft, id, direction)));
  }

  function remove(id) {
    if (!selectSceneItem(getProject(), id)) return;
    if (selectedId === id) selectedId = null;
    commit((draft) => Object.assign(draft, removeSceneItem(draft, id)));
  }

  function resetChatDialog() {
    if (elements.canvasChatName) {
      elements.canvasChatName.value = '';
      elements.canvasChatName.removeAttribute('aria-invalid');
    }
    if (elements.canvasChatInput) {
      elements.canvasChatInput.value = '';
      elements.canvasChatInput.removeAttribute('aria-invalid');
    }
    if (elements.canvasChatError) elements.canvasChatError.textContent = '';
  }

  function openChatDialog() {
    if (!elements.canvasChatDialog?.showModal) return;
    resetChatDialog();
    elements.canvasChatDialog.showModal();
    elements.canvasChatName?.focus();
  }

  function closeChatDialog() {
    elements.canvasChatDialog?.close?.();
  }

  function submitChatDialog(event) {
    event.preventDefault();
    const name = elements.canvasChatName?.value.trim() ?? '';
    const input = elements.canvasChatInput?.value.trim() ?? '';
    elements.canvasChatName?.removeAttribute('aria-invalid');
    elements.canvasChatInput?.removeAttribute('aria-invalid');

    if (!name) {
      elements.canvasChatName?.setAttribute('aria-invalid', 'true');
      if (elements.canvasChatError) elements.canvasChatError.textContent = 'Ad girin.';
      elements.canvasChatName?.focus();
      return;
    }
    if (!input) {
      elements.canvasChatInput?.setAttribute('aria-invalid', 'true');
      if (elements.canvasChatError) elements.canvasChatError.textContent = 'Sohbet metni girin.';
      elements.canvasChatInput?.focus();
      return;
    }

    let formattedLines;
    try {
      formattedLines = formatChatInput(input);
    } catch {
      if (elements.canvasChatError) {
        elements.canvasChatError.textContent = 'Sohbet biçimlendirilemedi. Metni kontrol edin.';
      }
      elements.canvasChatInput?.focus();
      return;
    }

    const snapshot = getProject();
    const customCount = snapshot.blocks.filter((block) => block.source === 'custom').length;
    const offset = 24 + (customCount + 1) * 16;
    const x = Math.min(offset, Math.max(24, snapshot.canvas.width - 25));
    const y = Math.min(offset, Math.max(24, snapshot.canvas.height - 25));
    const width = Math.max(1, Math.min(snapshot.canvas.width - 48, snapshot.canvas.width - x - 24));
    const height = Math.max(
      1,
      Math.min(snapshot.canvas.height - 48, snapshot.canvas.height - y - 24)
    );
    commit((draft) =>
      Object.assign(
        draft,
        addSceneItem(
          draft,
          createChatBlock({
            name,
            input,
            source: 'custom',
            formattedLines,
            transform: { x, y, width, height },
          })
        )
      )
    );
    closeChatDialog();
  }

  async function addAsset(file, background) {
    if (!file) return;
    if (background && !backgroundEditable()) return null;
    try {
      const asset = await assetRegistry.add(file);
      if (destroyed) {
        assetRegistry.remove(asset.id);
        return null;
      }
      if (background) {
        commit((draft) => {
          draft.canvas.background = {
            type: 'image',
            color: '#000000',
            assetId: asset.id,
            visible: true,
            locked: false,
          };
        });
      } else {
        commit((draft) =>
          Object.assign(
            draft,
            addSceneItem(
              draft,
              createImageLayer({
                name: asset.name || file.name || 'Görsel',
                assetId: asset.id,
                transform: { x: 0, y: 0, width: asset.width, height: asset.height },
              })
            )
          )
        );
      }
      setStatus(background ? 'Arka plan güncellendi' : 'Görsel eklendi');
      return asset;
    } catch (error) {
      if (!destroyed) setStatus(error?.message || 'Görsel yüklenemedi');
      return null;
    }
  }

  function clearBackground() {
    if (!backgroundEditable()) return;
    commit((draft) => {
      draft.canvas.background = {
        type: 'transparent',
        color: '#000000',
        assetId: null,
        visible: true,
        locked: false,
      };
    });
  }

  function undo() {
    project.undo?.();
    selectedId = null;
    void refresh().catch(() => {});
  }

  function redo() {
    project.redo?.();
    selectedId = null;
    void refresh().catch(() => {});
  }

  function clear() {
    selectedId = null;
    commit((draft) => {
      draft.layers = [];
      draft.blocks = [];
      if (!draft.canvas.background.locked) {
        draft.canvas.background = {
          type: 'transparent',
          color: '#000000',
          assetId: null,
          visible: true,
          locked: false,
        };
      }
    });
  }

  function handleStagePointerDown(event) {
    if (event.button !== 0 || mode !== 'canvas' || spacePressed) return;
    event.preventDefault?.();
    if (event.target.closest?.('.canvas-selection__handle') && selectedId) {
      beginResize(selectedId, event);
      return;
    }
    const point = projectPoint(event);
    const current = selectedUnlockedItem();
    const layout = layoutFor(getProject());
    let item = null;
    if (current && itemContainsPoint(current, point, layout)) {
      item = current;
    } else {
      item = itemAtPoint(point);
    }
    selectedId = item?.id ?? null;
    renderLayers();
    renderSelection();
    if (item) beginMove(item.id, event);
  }

  function handleStagePointerMove(event) {
    if (gesture?.pointerId !== undefined && event.pointerId !== gesture.pointerId) return;
    if (gesture?.type === 'move') move(event);
    if (gesture?.type === 'resize') resize(event);
  }

  function handleStagePointerEnd(event) {
    if (gesture?.pointerId !== undefined && event.pointerId !== gesture.pointerId) return;
    if (gesture?.type === 'move') endMove(event);
    else if (gesture?.type === 'resize') endResize(event);
  }

  function handleStagePointerCancel(event) {
    if (!gesture || (gesture.pointerId !== undefined && event.pointerId !== gesture.pointerId))
      return;
    endGesture(gesture.type, event, false);
  }

  function handleKeyboard(event) {
    if (mode !== 'canvas') return;
    const target = event.target;
    const tagName = String(target?.tagName ?? '').toUpperCase();
    const formTarget =
      ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tagName) ||
      target?.isContentEditable === true;
    if (event.key === ' ' && event.type === 'keyup') {
      spacePressed = false;
      if (!formTarget) event.preventDefault?.();
      return;
    }
    if (formTarget) return;
    if (event.key === ' ') {
      spacePressed = event.type === 'keydown';
      event.preventDefault?.();
      return;
    }
    if (event.type === 'keydown' && event.key?.startsWith('Arrow')) {
      if (nudge(event.key, 0, event.shiftKey)) event.preventDefault?.();
    }
  }

  function handleWheel(event) {
    if (!(event.ctrlKey || event.metaKey) || !elements.canvasViewport || !elements.canvasStage)
      return;
    event.preventDefault?.();
    const viewport = elements.canvasViewport;
    const clientX = Number(event.clientX) || 0;
    const clientY = Number(event.clientY) || 0;
    const stageRect = elements.canvasStage.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    const projectX = (clientX - stageRect.left) / zoom;
    const projectY = (clientY - stageRect.top) / zoom;
    const nextZoom = setZoom(zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
    const nextStageRect = elements.canvasStage.getBoundingClientRect?.() ?? stageRect;
    viewport.scrollLeft += nextStageRect.left + projectX * nextZoom - clientX;
    viewport.scrollTop += nextStageRect.top + projectY * nextZoom - clientY;
  }

  function handlePanStart(event) {
    if (mode !== 'canvas' || (event.button !== 1 && !(event.button === 0 && spacePressed))) return;
    event.preventDefault?.();
    if (gesture) endGesture(gesture.type, { pointerId: gesture.pointerId }, false);
    pan = {
      pointerId: event.pointerId,
      clientX: Number(event.clientX) || 0,
      clientY: Number(event.clientY) || 0,
      scrollLeft: elements.canvasViewport.scrollLeft,
      scrollTop: elements.canvasViewport.scrollTop,
    };
    elements.canvasViewport.setPointerCapture?.(event.pointerId);
  }

  function handlePanMove(event) {
    if (!pan || (pan.pointerId !== undefined && event.pointerId !== pan.pointerId)) return;
    elements.canvasViewport.scrollLeft =
      pan.scrollLeft + pan.clientX - (Number(event.clientX) || 0);
    elements.canvasViewport.scrollTop = pan.scrollTop + pan.clientY - (Number(event.clientY) || 0);
  }

  function handlePanEnd(event) {
    if (!pan || (pan.pointerId !== undefined && event.pointerId !== pan.pointerId)) return;
    elements.canvasViewport.releasePointerCapture?.(event.pointerId);
    pan = null;
  }

  let syncTimer = null;
  let chatObserver = null;

  function captureFormattedChatDrained() {
    const formattedLines = captureFormattedChat();
    try {
      chatObserver?.takeRecords?.();
    } catch {
      /* draining self-induced mutations is best-effort */
    }
    return formattedLines;
  }

  function linesEqual(a = [], b = []) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const lineA = a[i] ?? [];
      const lineB = b[i] ?? [];
      if (lineA.length !== lineB.length) return false;
      for (let j = 0; j < lineA.length; j++) {
        const segA = lineA[j];
        const segB = lineB[j];
        if (
          segA?.text !== segB?.text ||
          segA?.color !== segB?.color ||
          segA?.italic !== segB?.italic ||
          segA?.censored !== segB?.censored ||
          segA?.remove !== segB?.remove ||
          Boolean(segA?.opsec) !== Boolean(segB?.opsec)
        ) {
          return false;
        }
      }
    }
    return true;
  }

  function scheduleChatSync() {
    if (mode !== 'canvas' || destroyed) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      if (mode !== 'canvas' || destroyed) return;
      syncMainChat();
    }, 120);
  }

  function syncMainChat() {
    if (mode !== 'canvas' || destroyed) return;
    const snapshot = getProject();
    const mainBlock =
      snapshot.blocks.find((block) => block.source === 'main-chat') ??
      snapshot.blocks.find((block) => !block.source);
    if (!mainBlock) return;

    const chatlogInput = document.getElementById('chatlogInput');
    const currentInput = chatlogInput ? chatlogInput.value : (snapshot.chat?.input ?? '');
    const formattedLines = captureFormattedChatDrained();

    if (mainBlock.input === currentInput && linesEqual(mainBlock.formattedLines, formattedLines)) {
      return;
    }

    commit((draft) => {
      draft.chat.input = currentInput;
      Object.assign(
        draft,
        updateSceneItem(draft, mainBlock.id, {
          input: currentInput,
          source: 'main-chat',
          formattedLines,
        })
      );
    });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    listeners.splice(0).forEach((removeListener) => removeListener());
    if (animationFrame !== null) {
      const cancelFrame =
        document.defaultView?.cancelAnimationFrame ?? globalThis.cancelAnimationFrame;
      if (typeof cancelFrame === 'function') cancelFrame(animationFrame);
      else clearTimeout(animationFrame);
    }
    animationFrame = null;
    renderPending = false;
    gesture = null;
    previewProject = null;
    pan = null;
    assetRegistry.clear();
    renderer.clearCache?.();
    setMode('chat');
  }

  function listenInputAndChange(element, handler) {
    listen(element, 'change', handler);
    listen(element, 'input', handler);
  }

  if (elements.modeCanvas) elements.modeCanvas.disabled = !readiness(document);
  setMode('chat');
  listen(elements.modeChat, 'click', exit);
  listen(elements.modeCanvas, 'click', () => {
    enter().catch((error) => {
      console.error('Canvas mode failed to start:', error);
      setStatus(error?.message || 'Canvas modu açılamadı.');
    });
  });
  listen(elements.canvasAddChat, 'click', openChatDialog);
  listen(elements.canvasChatForm, 'submit', submitChatDialog);
  listen(elements.canvasChatCancel, 'click', closeChatDialog);
  listen(elements.canvasChatDialog, 'close', () => elements.canvasAddChat?.focus());
  listen(elements.canvasUndo, 'click', undo);
  listen(elements.canvasRedo, 'click', redo);
  listen(elements.canvasClear, 'click', clear);
  listen(
    elements.canvasBackgroundColor,
    'change',
    (event) =>
      backgroundEditable() &&
      commitControl((draft) => {
        draft.canvas.background.type = 'solid';
        draft.canvas.background.color = event.currentTarget.value;
      })
  );
  listenInputAndChange(
    elements.canvasBackgroundOpacity,
    (event) =>
      backgroundEditable() &&
      commitControl((draft) => {
        draft.canvas.background.opacity = boundedNumber(event.currentTarget.value, 1, 0, 1);
      })
  );
  listenInputAndChange(
    elements.canvasBackgroundBlur,
    (event) =>
      backgroundEditable() &&
      commitControl((draft) => {
        draft.canvas.background.blur = boundedNumber(event.currentTarget.value, 0, 0, 20);
      })
  );
  listenInputAndChange(
    elements.canvasBackgroundGrain,
    (event) =>
      backgroundEditable() &&
      commitControl((draft) => {
        draft.canvas.background.grain = boundedNumber(event.currentTarget.value, 0, 0, 100);
      })
  );
  listen(elements.canvasAddRedactionBox, 'click', () => {
    project.commit((draft) => {
      if (!Array.isArray(draft.redactionBoxes)) draft.redactionBoxes = [];
      const canvasWidth = Number(draft.canvas.width) || 600;
      const canvasHeight = Number(draft.canvas.height) || 600;
      draft.redactionBoxes.push({
        id: `redaction-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        x: Math.round(canvasWidth / 2 - 60),
        y: Math.round(canvasHeight / 2 - 15),
        width: 120,
        height: 30,
        visible: true,
      });
    });
    setStatus('Sansür kutusu eklendi.');
    render();
  });
  listen(elements.canvasDetectFaces, 'click', async () => {
    const snapshot = getProject();
    const bg = snapshot.canvas.background;
    if (bg.type !== 'image' || !bg.assetId) {
      setStatus('Yüz algılama için bir arka plan görseli gerekli.');
      return;
    }
    const asset = assetRegistry.get?.(bg.assetId);
    if (!asset || !asset.source) {
      setStatus('Arka plan görseli bulunamadı.');
      return;
    }

    const windowLike = document.defaultView ?? globalThis;
    if (typeof windowLike.FaceDetector !== 'function') {
      project.commit((draft) => {
        if (!Array.isArray(draft.redactionBoxes)) draft.redactionBoxes = [];
        const canvasWidth = Number(draft.canvas.width) || 600;
        const canvasHeight = Number(draft.canvas.height) || 600;
        draft.redactionBoxes.push({
          id: `redaction-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          x: Math.round(canvasWidth / 2 - 50),
          y: Math.round(canvasHeight / 3 - 25),
          width: 100,
          height: 50,
          visible: true,
        });
      });
      setStatus('Tarayıcı FaceDetector desteklemiyor. Varsayılan sansür kutusu eklendi.');
      render();
      return;
    }

    try {
      const faceDetector = new windowLike.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
      const faces = await faceDetector.detect(asset.source);
      if (!faces || faces.length === 0) {
        setStatus('Görselde yüz algılanamadı.');
        return;
      }
      project.commit((draft) => {
        if (!Array.isArray(draft.redactionBoxes)) draft.redactionBoxes = [];
        for (const face of faces) {
          const bb = face.boundingBox;
          draft.redactionBoxes.push({
            id: `redaction-face-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            x: Math.round(bb.x),
            y: Math.round(bb.y),
            width: Math.round(bb.width),
            height: Math.round(bb.height),
            visible: true,
          });
        }
      });
      setStatus(`${faces.length} yüz algılandı ve sansürlendi.`);
      render();
    } catch (err) {
      console.warn('Face detection error:', err);
      setStatus('Yüz algılama sırasında bir hata oluştu.');
    }
  });
  listen(elements.canvasComposition, 'change', (event) =>
    commitControl((draft) => {
      draft.canvas.composition = event.currentTarget.value;
    })
  );
  listenInputAndChange(elements.canvasPaddingX, (event) =>
    commitControl((draft) => {
      draft.canvas.padding.x = event.currentTarget.value;
    })
  );
  listenInputAndChange(elements.canvasPaddingY, (event) =>
    commitControl((draft) => {
      draft.canvas.padding.y = event.currentTarget.value;
    })
  );
  listen(elements.canvasFitMode, 'change', (event) =>
    commitControl((draft) => {
      draft.canvas.fitMode = event.currentTarget.value;
    })
  );
  listenInputAndChange(elements.canvasWidth, (event) =>
    commitControl((draft) => {
      draft.canvas.width = event.currentTarget.value;
    })
  );
  listenInputAndChange(elements.canvasHeight, (event) =>
    commitControl((draft) => {
      draft.canvas.height = event.currentTarget.value;
    })
  );
  listen(elements.canvasExportFormat, 'change', (event) =>
    commitControl((draft) => {
      draft.export.format = event.currentTarget.value;
    })
  );
  listenInputAndChange(elements.canvasJpegQuality, (event) =>
    commitControl((draft) => {
      draft.export.jpegQuality = event.currentTarget.value;
    })
  );
  listen(elements.canvasCopy, 'click', () => void exportCanvas('copy'));
  listen(elements.canvasDownload, 'click', () => void exportCanvas('download'));
  listen(elements.canvasLayerList, 'click', handleLayerAction);
  listen(elements.canvasLayerList, 'input', handleLayerOpacityInput);
  listen(elements.canvasLayerList, 'change', handleLayerChange);
  listen(elements.canvasStage, 'pointerdown', handleStagePointerDown);
  listen(elements.canvasStage, 'pointermove', handleStagePointerMove);
  listen(elements.canvasStage, 'pointerup', handleStagePointerEnd);
  listen(elements.canvasStage, 'pointercancel', handleStagePointerCancel);
  listen(document, 'pointerup', (event) => {
    if (gesture) handleStagePointerEnd(event);
  });
  listen(document, 'pointercancel', (event) => {
    if (gesture) handleStagePointerCancel(event);
  });
  listen(elements.canvasViewport, 'wheel', handleWheel);
  listen(elements.canvasViewport, 'pointerdown', handlePanStart);
  listen(elements.canvasViewport, 'pointermove', handlePanMove);
  listen(elements.canvasViewport, 'pointerup', handlePanEnd);
  listen(elements.canvasViewport, 'pointercancel', handlePanEnd);
  listen(document, 'keydown', handleKeyboard);
  listen(document, 'keyup', handleKeyboard);
  listen(elements.canvasBackgroundUpload, 'click', () => elements.canvasBackgroundInput?.click());
  listen(elements.canvasImageUpload, 'click', () => elements.canvasImageInput?.click());
  listen(elements.canvasBackgroundInput, 'change', (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    void addAsset(file, true);
  });
  listen(elements.canvasImageInput, 'change', (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    void addAsset(file, false);
  });

  const chatlogInput = document.getElementById('chatlogInput');
  const fontLabel = document.getElementById('font-label');
  const lineSpacingInput = document.getElementById('lineSpacingInput');
  const lineLengthInput = document.getElementById('lineLengthInput');
  const outputElement = elements.output ?? document.getElementById('output');

  listen(chatlogInput, 'input', scheduleChatSync);
  listen(fontLabel, 'input', scheduleChatSync);
  listen(fontLabel, 'change', scheduleChatSync);
  listen(lineSpacingInput, 'input', scheduleChatSync);
  listen(lineSpacingInput, 'change', scheduleChatSync);
  listen(lineLengthInput, 'input', scheduleChatSync);
  listen(lineLengthInput, 'change', scheduleChatSync);
  listen(document, 'chatlogProcessed', scheduleChatSync);

  const MutationObserverConstructor =
    document.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (typeof MutationObserverConstructor === 'function' && outputElement) {
    try {
      const observer = new MutationObserverConstructor(() => {
        scheduleChatSync();
      });
      observer.observe(outputElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      chatObserver = observer;
      listeners.push(() => {
        observer.disconnect();
        if (chatObserver === observer) chatObserver = null;
      });
    } catch {
      /* intentionally empty */
    }
  }

  updateHistoryControls();

  return {
    enter,
    exit,
    getProject,
    render,
    refresh,
    syncMainChat,
    toBlob,
    prepareAsset,
    prepareReplacementAsset,
    getAsset: persistentAsset,
    hasAsset: (id) => assetRegistry.has(id),
    listAssets,
    removeAsset: (id) => assetRegistry.remove(id),
    clearAssets: () => assetRegistry.clear(),
    destroy,
    select,
    getSelection,
    nudge,
    beginMove,
    move,
    endMove,
    beginResize,
    resize,
    endResize,
    setZoom,
    getZoom,
    fitViewport,
    toggleLock,
    toggleVisibility,
    remove,
  };
}

export function initializeCanvasController(windowLike: any = window, documentLike: any = document) {
  if (windowLike.ChatlogCanvas) return windowLike.ChatlogCanvas;
  if (!windowLike.ChatlogProject) {
    console.error('Canvas controller requires ChatlogProject; canvas mode disabled.');
    const modeCanvas = documentLike.getElementById?.('modeCanvas');
    if (modeCanvas) modeCanvas.disabled = true;
    return null;
  }
  const assetRegistry = createCanvasAssetRegistry();
  const renderer = createCanvasRenderer({
    assetRegistry,
    formatBlock: (block) => formatChatBlock(block, windowLike.ChatlogParser),
  });
  const controller = createCanvasController({
    document: documentLike,
    project: windowLike.ChatlogProject,
    assetRegistry,
    renderer,
    captureFormattedChat: () => {
      windowLike.ChatlogParser?.processOutput?.();
      return formattedLinesFromOutput(
        documentLike.getElementById('output'),
        windowLike.getComputedStyle?.bind(windowLike)
      );
    },
    formatChatInput: (input) =>
      formatChatBlock({ input, source: 'custom' }, windowLike.ChatlogParser),
  });
  windowLike.ChatlogCanvas = {
    enter: controller.enter,
    exit: controller.exit,
    getProject: controller.getProject,
    render: controller.render,
    toBlob: controller.toBlob,
    refresh: controller.refresh,
    prepareAsset: controller.prepareAsset,
    prepareReplacementAsset: controller.prepareReplacementAsset,
    getAsset: controller.getAsset,
    hasAsset: controller.hasAsset,
    listAssets: controller.listAssets,
    removeAsset: controller.removeAsset,
    clearAssets: controller.clearAssets,
    destroy: controller.destroy,
  };
  return windowLike.ChatlogCanvas;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initializeCanvasController());
}
