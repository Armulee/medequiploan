'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/** One page of a list: the rows themselves, and how many there are in total. */
export type ListPage<T> = { items: T[]; total: number };
export type FetchPage<T> = (offset: number, limit: number) => Promise<ListPage<T>>;

export const PAGE_SIZE = 20;

/**
 * A list that starts at twenty rows and fetches the next twenty when the
 * bottom comes into view.
 *
 * Every staff list used to load its whole table and render all of it, which
 * is fine with five rows and hopeless with five thousand — the loan history
 * and the audit log both grow forever. The page is fetched, not sliced from
 * something already downloaded, so the first paint costs the same whatever
 * the table has grown to.
 *
 * `fetchPage` must be stable (useCallback over whatever filters it reads):
 * changing it is what resets the list back to the first page, which is
 * exactly what should happen when a filter changes.
 */
export function useInfiniteList<T>(fetchPage: FetchPage<T>, pageSize = PAGE_SIZE) {
  const [items, setItems] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloads, setReloads] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Not state: the observer callback reads these, and re-running it on every
  // fetch would tear down and rebuild the observer mid-scroll.
  const cursor = useRef({ busy: false, done: false, loaded: 0 });

  useEffect(() => {
    let cancelled = false;
    cursor.current = { busy: true, done: false, loaded: 0 };
    setItems(null);
    setTotal(0);

    fetchPage(0, pageSize)
      .then((p) => {
        if (cancelled) return;
        setItems(p.items);
        setTotal(p.total);
        cursor.current = {
          busy: false,
          done: p.items.length === 0 || p.items.length >= p.total,
          loaded: p.items.length,
        };
      })
      .catch((e) => {
        if (cancelled) return;
        setItems([]);
        cursor.current = { busy: false, done: true, loaded: 0 };
        toast.error(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ');
      });

    return () => {
      cancelled = true;
    };
  }, [fetchPage, pageSize, reloads]);

  const loadMore = useCallback(async () => {
    const c = cursor.current;
    if (c.busy || c.done) return;
    c.busy = true;
    setLoadingMore(true);
    try {
      const p = await fetchPage(c.loaded, pageSize);
      setItems((prev) => [...(prev ?? []), ...p.items]);
      setTotal(p.total);
      c.loaded += p.items.length;
      c.done = p.items.length === 0 || c.loaded >= p.total;
    } catch (e) {
      // Stop rather than retry on every scroll tick; the toast says why.
      c.done = true;
      toast.error(e instanceof Error ? e.message : 'โหลดรายการเพิ่มไม่สำเร็จ');
    } finally {
      c.busy = false;
      setLoadingMore(false);
    }
  }, [fetchPage, pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    // rootMargin so the next page is already arriving as the last rows appear,
    // instead of the reader hitting a stop and waiting.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, items]);

  return {
    items,
    total,
    loadingMore,
    sentinelRef,
    /** Re-fetch from the first page — after approving, returning, lending... */
    reload: useCallback(() => setReloads((n) => n + 1), []),
  };
}

/**
 * The same paging over an array already in memory.
 *
 * A foundation has a handful of staff accounts and a couple of dozen kinds of
 * equipment, and both those pages filter and sort in the browser on purpose —
 * a round trip per keystroke would be wasted. They still render twenty rows at
 * a time, so every list in the app behaves the same way.
 *
 * Pass the filtered array; a new identity resets the list to its first page,
 * which is what changing a filter should do.
 */
export function useArrayPage<T>(all: T[] | null | undefined): FetchPage<T> {
  // null is normalised to ONE shared empty array. A caller writing `?? []`
  // themselves would hand a fresh array to every render, and since a new
  // array means "the filter changed, start over", the list would reset on
  // every render and the page would never hold still.
  const rows = all ?? (EMPTY as T[]);
  return useCallback(
    async (offset: number, limit: number) => ({
      items: rows.slice(offset, offset + limit),
      total: rows.length,
    }),
    [rows]
  );
}

const EMPTY: unknown[] = [];

/**
 * How many rows there are, above the first one. Without it a list that stops
 * at twenty looks like the whole thing.
 */
export function ListCount({
  shown,
  total,
  noun = 'รายการ',
}: {
  shown: number;
  total: number;
  noun?: string;
}) {
  if (total === 0) return null;
  const n = (v: number) => v.toLocaleString('th-TH');
  return (
    <div className="list-count">
      {shown < total ? (
        <>
          แสดง <strong>{n(shown)}</strong> จาก <strong>{n(total)}</strong> {noun}
        </>
      ) : (
        <>
          ทั้งหมด <strong>{n(total)}</strong> {noun}
        </>
      )}
    </div>
  );
}

/** The bottom of the list: what the observer watches, and what it says. */
export function ListMore({
  sentinelRef,
  loading,
  shown,
  total,
}: {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  shown: number;
  total: number;
}) {
  const more = shown < total;
  return (
    <div className="list-more" ref={sentinelRef}>
      {loading ? 'กำลังโหลดเพิ่ม...' : more ? 'เลื่อนลงเพื่อดูเพิ่ม' : ''}
    </div>
  );
}
