import { Router } from 'express';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '../../db/repo-content';
import { validateTemplatePayload } from '../../shared/template-validation';
import { layoutFromClassic } from '../../shared/template-v2-migration';
import { createEmptyPayload, PLACEHOLDERS, type TemplateKind } from '../../shared/template-types';

const VALID_KINDS: TemplateKind[] = ['announcement', 'panel', 'dm', 'welcome'];

function parseKind(value: unknown): TemplateKind | null {
  return typeof value === 'string' && VALID_KINDS.includes(value as TemplateKind)
    ? (value as TemplateKind)
    : null;
}

export const templateRoutes = Router();

templateRoutes.get('/', (request, response) => {
  const kind = parseKind(request.query.kind);
  response.json({
    templates: listTemplates(kind ?? undefined),
    placeholders: PLACEHOLDERS,
  });
});

templateRoutes.get('/:id', (request, response) => {
  const template = getTemplate(Number(request.params.id));
  if (!template) {
    response.status(404).json({ error: 'Không tìm thấy template' });
    return;
  }
  response.json({ template, issues: validateTemplatePayload(template.payload) });
});

templateRoutes.post('/', (request, response) => {
  const body = request.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const kind = parseKind(body.kind);

  if (!name) {
    response.status(400).json({ error: 'Thiếu tên template' });
    return;
  }
  if (!kind) {
    response.status(400).json({ error: `kind phải là một trong: ${VALID_KINDS.join(', ')}` });
    return;
  }

  const payload = (body.payload as ReturnType<typeof createEmptyPayload>) ?? createEmptyPayload();
  const template = createTemplate({ name, kind, payload });
  response.status(201).json({ template, issues: validateTemplatePayload(template.payload) });
});

templateRoutes.put('/:id', (request, response) => {
  const body = request.body as Record<string, unknown>;
  const template = updateTemplate(Number(request.params.id), {
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    kind: parseKind(body.kind) ?? undefined,
    payload: body.payload as ReturnType<typeof createEmptyPayload> | undefined,
  });

  if (!template) {
    response.status(404).json({ error: 'Không tìm thấy template' });
    return;
  }
  response.json({ template, issues: validateTemplatePayload(template.payload) });
});

templateRoutes.delete('/:id', (request, response) => {
  response.json({ removed: deleteTemplate(Number(request.params.id)) });
});

/** Kiểm tra nội dung mà không lưu — dashboard gọi khi người dùng đang gõ. */
templateRoutes.post('/validate', (request, response) => {
  const payload = (request.body as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ error: 'Thiếu payload' });
    return;
  }
  response.json({ issues: validateTemplatePayload(payload as ReturnType<typeof createEmptyPayload>) });
});

/**
 * Chuyển text + embed hiện có thành khối Components V2. Composer gọi khi bật V2
 * để nội dung đang soạn không bị bỏ lại ở chỗ Discord không đọc.
 */
templateRoutes.post('/to-components-v2', (request, response) => {
  const payload = (request.body as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ error: 'Thiếu payload' });
    return;
  }
  response.json({ v2: layoutFromClassic(payload as ReturnType<typeof createEmptyPayload>) });
});
