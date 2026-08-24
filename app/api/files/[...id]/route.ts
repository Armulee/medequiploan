import { requireAuth, route } from '@/lib/api';
import { readUpload } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string[] }> };

// ID-card and illness photos are health data, so every fetch goes through a
// session check. Nothing is served straight from a storage URL.
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { id } = await params;
  const file = await readUpload(id.join('/'));
  if (!file) return new Response('ไม่พบไฟล์', { status: 404 });

  return new Response(file.body as BodyInit, {
    headers: {
      'Content-Type': file.contentType,
      // private: keep PII out of shared/CDN caches, but let the staff member's
      // own browser reuse it instead of re-downloading on every render.
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
