import { describe, expect, it } from 'vitest';
import { createProjectController } from '../public/js/project-controller.ts';
import { createProject } from '../public/js/project-model.ts';

describe('project controller explicit-save baselines', () => {
  it('tracks explicit-save timestamps independently for each project id', () => {
    const project = createProjectController({
      document: {},
      initialProject: createProject({ metadata: { id: 'one' } }),
    });
    project.markExplicitSave(100);
    project.replaceSnapshot(createProject({ metadata: { id: 'two' } }));
    expect(project.getLastExplicitSaveAt()).toBe(0);
    project.markExplicitSave(200);

    project.replaceSnapshot(createProject({ metadata: { id: 'one' } }));

    expect(project.getLastExplicitSaveAt()).toBe(100);
  });
});
