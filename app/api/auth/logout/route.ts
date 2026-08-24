import { json, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { getSession } from '@/lib/session';

export const POST = route(async () => {
  const session = await getSession();
  const user = session.user ?? null;
  if (user) {
    await logAction({ actor: user, action: 'logout', targetType: 'user', targetId: user.user_id });
  }
  session.destroy();
  return json({ ok: true });
});
