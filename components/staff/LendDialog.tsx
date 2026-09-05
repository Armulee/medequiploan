'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiJson } from '@/app/lib/api';
import type { Equipment } from '@/app/lib/types';

/** Two weeks out — the common case, still editable. Same default as approving. */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

/**
 * Handing an item to the person whose page you are already on. Opened from
 * the borrower page, so there is nobody to search for — the borrower is the
 * page, and only the equipment and the due date are left to choose.
 */
export default function LendDialog({
  borrowerId,
  borrowerName,
  onClose,
  onDone,
}: {
  borrowerId: string;
  borrowerName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [equipmentId, setEquipmentId] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [invalid, setInvalid] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setEquipment(d.equipment))
      .catch((e) => {
        setEquipment([]);
        toast.error(e instanceof Error ? e.message : 'โหลดรายการอุปกรณ์ไม่สำเร็จ');
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInvalid('');
    if (!equipmentId) return setInvalid('กรุณาเลือกอุปกรณ์ที่จะจ่าย');

    setBusy(true);
    try {
      await apiJson('/api/records', 'POST', {
        borrower_id: borrowerId,
        equipment_id: equipmentId,
        due_date: dueDate || null,
      });
      const name = equipment?.find((x) => x.equipment_id === equipmentId)?.name ?? equipmentId;
      toast.success(`จ่าย ${name} ให้ ${borrowerName} แล้ว`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกการยืมไม่สำเร็จ');
      setBusy(false);
    }
  }

  const available = (equipment ?? []).filter((e) => e.available_qty > 0);

  return (
    <Dialog title="จ่ายอุปกรณ์" subtitle={borrowerName} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="lend_equipment">อุปกรณ์ *</label>
          {/* No `required`: the browser would block the submit with its own
              popup and this field's Thai message would never be reached. */}
          <select
            id="lend_equipment"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            autoFocus
          >
            <option value="">
              {equipment === null ? 'กำลังโหลด...' : '-- เลือกอุปกรณ์ --'}
            </option>
            {(equipment ?? []).map((e) => (
              <option key={e.equipment_id} value={e.equipment_id} disabled={e.available_qty <= 0}>
                {e.name} (เหลือ {e.available_qty})
                {e.available_qty <= 0 ? ' — หมด' : ''}
              </option>
            ))}
          </select>
          {invalid ? (
            <div className="hint hint-error">{invalid}</div>
          ) : (
            equipment !== null && (
              <div className="hint">
                {available.length > 0
                  ? `มีอุปกรณ์ให้ยืมได้ ${available.length} รายการ`
                  : 'ตอนนี้ไม่มีอุปกรณ์ว่างให้ยืม'}
              </div>
            )
          )}
        </div>

        <div className="field">
          <label htmlFor="lend_due">กำหนดคืน</label>
          <input
            id="lend_due"
            type="date"
            value={dueDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <div className="hint">เว้นว่างได้ถ้ายังไม่กำหนด · รายการที่เลยวันนี้จะขึ้นว่าเกินกำหนด</div>
        </div>

        <DialogActions confirmLabel="ยืนยันจ่ายอุปกรณ์" onCancel={onClose} busy={busy} />
      </form>
    </Dialog>
  );
}
