'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import Icon from '@/components/Icon';
import { api, apiJson } from '@/app/lib/api';
import type { Equipment } from '@/app/lib/types';

const REASONS = ['ชำรุด', 'สูญหาย', 'ส่งซ่อม', 'รับกลับจากซ่อม'] as const;

export default function StockTab({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adjusting, setAdjusting] = useState<Equipment | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setItems(d.equipment))
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลดสต็อกไม่สำเร็จ'));
  }, []);

  useEffect(load, [load]);

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
        ) : items.length === 0 ? (
          <div className="empty-state">ยังไม่มีอุปกรณ์ในระบบ</div>
        ) : (
          <div className="list">
            {items.map((e) => (
              <div className="list-row" key={e.equipment_id}>
                <div>
                  <div className="title">
                    {e.name}
                    {e.low_stock && (
                      <span className="badge badge-low" style={{ marginLeft: 8 }}>
                        <Icon name="alert" size={12} /> สต็อกใกล้หมด
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
                  <button className="btn btn-sm btn-outline" onClick={() => setAdjusting(e)}>
                    ตัดสต็อก
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {adjusting && (
        <AdjustDialog
          item={adjusting}
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
  onClose,
  onDone,
}: {
  item: Equipment;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [reason, setReason] = useState<(typeof REASONS)[number]>('ชำรุด');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiJson(`/api/equipment/${item.equipment_id}/adjust`, 'POST', { reason, qty, note });
      onDone(`${reason} ${qty} ชิ้น: ${item.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ตัดสต็อกไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>ตัดสต็อก: {item.name}</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
          คงเหลือ {item.available_qty} · ทั้งหมด {item.total_qty}
        </p>

        <Alert kind="error">{error}</Alert>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="adj_reason">เหตุผล *</label>
            <select
              id="adj_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
            >
              {REASONS.map((r) => (
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

          <div className="field">
            <label htmlFor="adj_qty">จำนวน *</label>
            <input
              id="adj_qty"
              type="text"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="adj_note">หมายเหตุ</label>
            <input id="adj_note" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
