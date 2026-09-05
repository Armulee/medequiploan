'use client';

import { ImagePlus, Pencil, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiForm, apiJson } from '@/app/lib/api';
import { formatBytes, resizeImage } from '@/app/lib/resize-image';
import { ListCount, ListMore, PAGE_SIZE, useArrayPage, useInfiniteList } from './InfiniteList';
import type { Equipment } from '@/app/lib/types';

const REMOVE_REASONS = ['ชำรุด', 'สูญหาย', 'ส่งซ่อม', 'รับกลับจากซ่อม'] as const;

export default function StockTab({
  isAdmin,
  initialLowOnly,
}: {
  isAdmin: boolean;
  initialLowOnly?: boolean;
}) {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [adjusting, setAdjusting] = useState<{ item: Equipment; mode: 'add' | 'remove' } | null>(null);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [lowOnly, setLowOnly] = useState(Boolean(initialLowOnly));

  const load = useCallback(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setItems(d.equipment))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'โหลดสต็อกไม่สำเร็จ'));
  }, []);

  useEffect(load, [load]);

  const shown = useMemo(
    () => (items ?? []).filter((e) => !lowOnly || e.low_stock),
    [items, lowOnly]
  );
  // The whole catalogue is small enough to filter in the browser; only the
  // rendering is paged, like every other list here.
  const { items: paged, total, loadingMore, sentinelRef } = useInfiniteList(
    useArrayPage(shown),
    PAGE_SIZE
  );

  return (
    <>
      <div className="card">
        {/* card-head-row, like the staff page: on a phone the stacked default
            gave "+ เพิ่มอุปกรณ์" the full width of the card and pushed the
            whole list down for a button that is used once in a while. */}
        <div className="card-head card-head-row">
          <h1>สต็อกอุปกรณ์</h1>
          {isAdmin && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? 'ปิด' : '+ เพิ่มอุปกรณ์'}
            </button>
          )}
        </div>

        <div className="filter-row">
          <button
            className={`btn btn-sm ${lowOnly ? 'btn-outline' : 'btn-primary'}`}
            onClick={() => setLowOnly(false)}
          >
            ทั้งหมด
          </button>
          <button
            className={`btn btn-sm ${lowOnly ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setLowOnly(true)}
          >
            ใกล้หมดเท่านั้น
          </button>
        </div>

        {showAdd && isAdmin && (
          <AddEquipmentForm
            onDone={(msg) => {
              toast.success(msg);
              setShowAdd(false);
              load();
            }}
          />
        )}

        {items === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            {lowOnly ? 'ไม่มีอุปกรณ์ที่ใกล้หมด' : 'ยังไม่มีอุปกรณ์ในระบบ'}
          </div>
        ) : (
          <>
          <ListCount shown={paged?.length ?? 0} total={total} />
          <div className="list">
            {(paged ?? []).map((e) => (
              <div className="list-row" key={e.equipment_id}>
                <div>
                  <div className="title">
                    {e.name}
                    {e.low_stock && (
                      <span className="badge badge-low" style={{ marginLeft: 8 }}>
                        <TriangleAlert size={12} /> สต็อกใกล้หมด
                      </span>
                    )}
                  </div>
                  <div className="sub">
                    {e.category || 'ไม่ระบุหมวด'} · คงเหลือ <strong>{e.available_qty}</strong> ·
                    ถูกยืม {e.borrowed_qty}
                    {e.repair_qty > 0 ? ` · ส่งซ่อม ${e.repair_qty}` : ''} · ทั้งหมด {e.total_qty}
                  </div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="icon-btn"
                      onClick={() => setEditing(e)}
                      aria-label={`แก้ไข ${e.name}`}
                      title="แก้ไขรายละเอียด"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setAdjusting({ item: e, mode: 'add' })}
                    >
                      + เพิ่ม
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setAdjusting({ item: e, mode: 'remove' })}
                    >
                      − ตัดสต็อก
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <ListMore
            sentinelRef={sentinelRef}
            loading={loadingMore}
            shown={paged?.length ?? 0}
            total={total}
          />
          </>
        )}
      </div>

      {adjusting && (
        <AdjustDialog
          item={adjusting.item}
          mode={adjusting.mode}
          onClose={() => setAdjusting(null)}
          onDone={(msg) => {
            toast.success(msg);
            setAdjusting(null);
            load();
          }}
        />
      )}

      {editing && (
        <EditEquipmentDialog
          item={editing}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            toast.success(msg);
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

/**
 * The photo field, shared by the add form and the edit dialog. Resized in the
 * browser before it is sent, like the illness photos: a phone camera file is
 * several megabytes and this one ends up on the public landing page.
 */
function PhotoField({
  id,
  current,
  file,
  onPick,
  onClear,
}: {
  id: string;
  current?: string;
  file: File | null;
  onPick: (f: File | null) => void;
  onClear?: () => void;
}) {
  const [note, setNote] = useState('');
  const preview = file ? URL.createObjectURL(file) : current || '';

  return (
    <div className="field">
      <label htmlFor={id}>รูปอุปกรณ์</label>
      <div className="photo-field">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="photo-field-preview" />
        ) : (
          <span className="photo-field-empty">
            <ImagePlus size={26} />
          </span>
        )}
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <input
            id={id}
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const picked = e.target.files?.[0];
              if (!picked) {
                onPick(null);
                setNote('');
                return;
              }
              setNote('กำลังย่อรูป...');
              const resized = await resizeImage(picked);
              onPick(resized);
              setNote(
                resized.size < picked.size
                  ? `ย่อรูปแล้ว ${formatBytes(picked.size)} → ${formatBytes(resized.size)}`
                  : `ขนาดไฟล์ ${formatBytes(resized.size)}`
              );
            }}
          />
          {note && <div className="hint">{note}</div>}
          {onClear && current && !file && (
            <button type="button" className="btn btn-sm btn-outline" onClick={onClear} style={{ marginTop: 8 }}>
              ลบรูปนี้
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddEquipmentForm({ onDone }: { onDone: (msg: string) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [qty, setQty] = useState('');
  const [threshold, setThreshold] = useState('2');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData();
      form.append('name', name);
      form.append('category', category);
      form.append('total_qty', qty);
      form.append('low_stock_threshold', threshold);
      if (photo) form.append('image', photo);
      await apiForm('/api/equipment', form);
      onDone(`เพิ่ม "${name}" เข้าสต็อกแล้ว`);
      setName('');
      setCategory('');
      setQty('');
      setPhoto(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เพิ่มอุปกรณ์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      <div className="row">
        <div className="field">
          <label htmlFor="eq_name">ชื่ออุปกรณ์ *</label>
          <input id="eq_name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="eq_cat">หมวดหมู่</label>
          <input id="eq_cat" type="text" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="eq_qty">จำนวนทั้งหมด *</label>
          <input id="eq_qty" type="text" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="eq_thr">แจ้งเตือนเมื่อเหลือ ≤</label>
          <input id="eq_thr" type="text" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
      </div>
      <PhotoField id="eq_photo" file={photo} onPick={setPhoto} />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'กำลังบันทึก...' : 'บันทึกอุปกรณ์'}
      </button>
    </form>
  );
}

function AdjustDialog({
  item,
  mode,
  onClose,
  onDone,
}: {
  item: Equipment;
  mode: 'add' | 'remove';
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [reason, setReason] = useState<(typeof REMOVE_REASONS)[number]>('ชำรุด');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Step two exists so a mistyped quantity is caught while it is still a
  // number on screen rather than after the stock has already moved.
  const [confirming, setConfirming] = useState(false);

  const amount = Number.parseInt(qty, 10);
  const valid = Number.isFinite(amount) && amount > 0;
  const effectiveReason = mode === 'add' ? 'รับเข้าเพิ่ม' : reason;

  // What the counts become if this goes through.
  const nextAvailable = mode === 'add' ? item.available_qty + amount : item.available_qty - amount;
  const nextTotal =
    mode === 'add'
      ? item.total_qty + amount
      : effectiveReason === 'ชำรุด' || effectiveReason === 'สูญหาย'
        ? item.total_qty - amount
        : item.total_qty;

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await apiJson(`/api/equipment/${item.equipment_id}/adjust`, 'POST', {
        reason: effectiveReason,
        qty,
        note,
      });
      onDone(
        mode === 'add'
          ? `เพิ่ม ${item.name} จำนวน ${amount} ชิ้น`
          : `${effectiveReason} ${amount} ชิ้น: ${item.name}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setConfirming(false);
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <Dialog
        title={mode === 'add' ? 'ยืนยันการเพิ่มสต็อก' : 'ยืนยันการตัดสต็อก'}
        onClose={() => (busy ? undefined : setConfirming(false))}
      >
        <div className="confirm-summary">
          {mode === 'add' ? 'ต้องการเพิ่ม' : `ต้องการตัดสต็อก (${effectiveReason})`}
          <br />
          <strong>{item.name}</strong>
          <br />
          จำนวน{' '}
          <span className={`confirm-delta ${mode === 'add' ? 'up' : 'down'}`}>
            {mode === 'add' ? '+' : '−'}
            {amount} ชิ้น
          </span>{' '}
          ใช่หรือไม่
          <br />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            คงเหลือ {item.available_qty} → {nextAvailable} · ทั้งหมด {item.total_qty} → {nextTotal}
            {note ? ` · หมายเหตุ: ${note}` : ''}
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <DialogActions
            confirmLabel={mode === 'add' ? 'ยืนยันเพิ่ม' : 'ยืนยันตัดสต็อก'}
            onCancel={() => setConfirming(false)}
            busy={busy}
            danger={mode === 'remove'}
          />
        </form>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={mode === 'add' ? `เพิ่มสต็อก: ${item.name}` : `ตัดสต็อก: ${item.name}`}
      subtitle={`คงเหลือ ${item.available_qty} · ทั้งหมด ${item.total_qty}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return setError('จำนวนต้องเป็นตัวเลขมากกว่า 0');
          if (mode === 'remove' && amount > item.available_qty) {
            return setError(`จำนวนคงเหลือไม่พอ (เหลือ ${item.available_qty} ชิ้น)`);
          }
          setError('');
          setConfirming(true);
        }}
      >
        {mode === 'remove' && (
          <div className="field">
            <label htmlFor="adj_reason">เหตุผล *</label>
            <select
              id="adj_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof REMOVE_REASONS)[number])}
            >
              {REMOVE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="hint">
              {reason === 'ชำรุด' || reason === 'สูญหาย'
                ? 'ตัดออกถาวร ลดทั้งจำนวนคงเหลือและจำนวนทั้งหมด'
                : reason === 'ส่งซ่อม'
                  ? 'ตัดออกชั่วคราว จำนวนทั้งหมดไม่เปลี่ยน'
                  : 'คืนของที่ส่งซ่อมกลับเข้าสต็อก'}
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="adj_qty">จำนวน *</label>
          <input
            id="adj_qty"
            type="text"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
          />
          {/* Beside the number it is about, not in a banner at the top of the
              dialog and not in a toast that would cover this very field. */}
          {error && <div className="hint hint-error">{error}</div>}
        </div>

        <div className="field">
          <label htmlFor="adj_note">หมายเหตุ</label>
          <input id="adj_note" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <DialogActions confirmLabel="ถัดไป" onCancel={onClose} danger={mode === 'remove'} />
      </form>
    </Dialog>
  );
}

/**
 * Everything about an item except its quantity, which has its own two-step
 * dialog because it moves real stock. Renaming a wheelchair or replacing its
 * photograph does not, so one step is enough.
 */
function EditEquipmentDialog({
  item,
  onClose,
  onDone,
}: {
  item: Equipment;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [threshold, setThreshold] = useState(String(item.low_stock_threshold));
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('ชื่ออุปกรณ์ว่างไม่ได้');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('category', category.trim());
      form.append('low_stock_threshold', threshold);
      if (photo) form.append('image', photo);
      else if (removePhoto) form.append('remove_image', 'true');
      await apiForm(`/api/equipment/${item.equipment_id}`, form, 'PUT');
      onDone(`บันทึก "${name.trim()}" แล้ว`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <Dialog title="แก้ไขรายละเอียดอุปกรณ์" subtitle={item.equipment_id} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="ed_name">ชื่ออุปกรณ์ *</label>
          <input id="ed_name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="ed_cat">หมวดหมู่</label>
            <input id="ed_cat" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ed_thr">แจ้งเตือนเมื่อเหลือ ≤</label>
            <input
              id="ed_thr"
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        </div>

        <PhotoField
          id="ed_photo"
          current={removePhoto ? '' : item.image}
          file={photo}
          onPick={(f) => {
            setPhoto(f);
            setRemovePhoto(false);
          }}
          onClear={() => setRemovePhoto(true)}
        />

        {/* Quantities are not here on purpose: they belong to the add and
            subtract dialogs, which log a reason and a stock adjustment. */}
        <div className="hint" style={{ marginBottom: 12 }}>
          จำนวนแก้ที่ปุ่ม “+ เพิ่ม” และ “− ตัดสต็อก” เพราะต้องบันทึกเหตุผลไว้ในประวัติ
        </div>

        <DialogActions confirmLabel="บันทึก" onCancel={onClose} busy={busy} />
      </form>
    </Dialog>
  );
}
