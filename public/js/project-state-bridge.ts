import { normalizeProject } from './project-model.js';

const CHAT_CONTROLS = [
  ['chatlogInput', 'input'],
  ['font-label', 'fontSize'],
  ['lineLengthInput', 'lineLength'],
  ['lineSpacingInput', 'lineSpacing'],
];

export function captureChatState(documentLike, baseProject) {
  const project = normalizeProject(baseProject);
  const parser = documentLike?.defaultView?.ChatlogParser;
  const parserState = parser?.captureProjectChatState?.() ?? {};
  const chat = { ...project.chat, ...parserState };

  for (const [controlId, chatField] of CHAT_CONTROLS) {
    const control = documentLike.getElementById(controlId);
    if (control) chat[chatField] = control.value;
  }

  return normalizeProject({ ...project, chat });
}

export function applyChatState(documentLike, project) {
  const normalized = normalizeProject(project);

  for (const [controlId, chatField] of CHAT_CONTROLS) {
    const control = documentLike.getElementById(controlId);
    if (control) control.value = normalized.chat[chatField];
  }
  return documentLike?.defaultView?.ChatlogParser?.applyProjectChatState?.(normalized.chat);
}

export async function renderProjectState(documentLike, project, { canvas }: any = {}) {
  const normalized = normalizeProject(project);
  await Promise.resolve(applyChatState(documentLike, normalized));
  await Promise.resolve(canvas?.refresh?.() ?? canvas?.render?.());
  return normalized;
}
