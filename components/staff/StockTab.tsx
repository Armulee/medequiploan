'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import Dialog, { DialogActions } from '@/components/Dialog';
import { TriangleAlert } from 'lucide-react';
import { api, apiJson } from '@/app/lib/api';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adjusting, setAdjusting] = useState<{ item: Equipment; mode: 'add' | 'remove' } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [lowOnly, setLowOnly] = useState(Boolean(initialLowOnly));

  const load = useCallback(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setItems(d.equipment))
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลดสต็อกไม่สำเร็จ'));
  }, []);

  useEffect(load, [load]);

  const shown = (items ?? []).filter((e) => !lowOnly || e.low_stock);

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h1>สต็อกอุปกรณ์</h1>
          {isAdmin && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? 'ปิด' : '+ เพิ่มอุปกรณ์'}
            </button>
          )}
        </div>

        <Alert kind="error">{error}</Alert>
        <Alert kind="success">{success}</Alert>

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
              setSuccess(msg);
              setShowAdd(false);
              load();
            }}
            onError={setError}
          />
        )}

        {items === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            {lowOnly ? 'ไม่มีอุปกรณ์ที่ใกล้หมด' : 'ยังไม่มีอุปกรณ์ในระบบ'}
          </div>
        ) : (
          <div className="list">
            {shown.map((e) => (
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
                  <div style={{ display: 'flex', gap: 6 }}>
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
        )}
      </div>

      {adjusting && (
        <AdjustDialog
          item={adjusting.item}
          mode={adjusting.mode}
          onClose={() => setAdjusting(null)}
          onDone={(msg) => {
            setSuccess(msg);
            setAdjusting(null);
            load();
          }}
        />
      )}
    </>
  );
}

function AddEquipmentForm({
  onDone,
  onError,
}: {
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [qty, setQty] = useState('');
  const [threshold, setThreshold] = useState('2');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiJson('/api/equipment', 'POST', {
        name,
        category,
        total_qty: qty,
        low_stock_threshold: threshold,
      });
      onDone(`เพิ่ม "${name}" เข้าสต็อกแล้ว`);
      setName('');
      setCategory('');
      setQty('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'เพิ่มอุปกรณ์ไม่สำเร็จ');
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
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
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
        <Alert kind="error">{error}</Alert>
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
      <Alert kind="error">{error}</Alert>
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
