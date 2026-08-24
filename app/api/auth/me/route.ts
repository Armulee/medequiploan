import { json, route } from '@/lib/api';
import { currentUser } from '@/lib/session';

export const GET = route(async () => json({ user: await currentUser() }));
