import { json, route } from '@/lib/api';
import { readUpload } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string[] }> };

/**
 * Catalogue photographs, served WITHOUT a session — deliberately, and unlike
 * /api/files: these are pictures of a wheelchair on a public landing page, not
 * a borrower's ID card. The path is restricted to the equipment folder so this
 * route cannot be walked into the health-data folders even though readUpload
 * would happily read them.
 */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const key = id.join('/');
  if (!key.startsWith('equipment/')) return json({ error: 'ไม่พบไฟล์' }, 404);

  const file = await readUpload(key);
  if (!file) return json({ error: 'ไม่พบไฟล์' }, 404);

  return new Response(file.body as BodyInit, {
    headers: {
      'Content-Type': file.contentType,
      // Names carry a random suffix, so a stored file never changes under a
      // given URL and can be cached hard.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
