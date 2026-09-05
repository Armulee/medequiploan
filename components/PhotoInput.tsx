'use client';

import { useEffect, useState } from 'react';
import { inspectPhoto, photoWarning } from '@/app/lib/image-check';
import { formatBytes, resizeImage } from '@/app/lib/resize-image';

/**
 * One photo field, shared by the public request form and the staff
 * registration form so both behave identically.
 *
 * No `capture` attribute: it used to say capture="environment", which on a
 * phone skips the picker and opens the camera outright. Someone who already
 * photographed their ID card, or who has it as a file, then had no way to
 * send it. Plain accept="image/*" offers the camera, the camera roll and the
 * files app, and the camera is still one tap away.
 */
export default function PhotoInput({
  id,
  label,
  hint,
  required = false,
  file,
  onPick,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  file: File | null;
  onPick: (file: File | null) => void;
}) {
  const [note, setNote] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);

  // The picked file is what the person is about to send, so show it — a photo
  // of the desk or the wrong side of the card is obvious in a thumbnail and
  // invisible in a filename.
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handle(picked: File | undefined) {
    if (!picked) {
      onPick(null);
      setNote('');
      setWarning(null);
      return;
    }
    setBusy(true);
    setNote('กำลังเตรียมรูป...');
    setWarning(null);
    try {
      // Checked before resizing: the resize is what would hide a photo that
      // was too small to read in the first place.
      const quality = await inspectPhoto(picked);
      const resized = await resizeImage(picked);
      onPick(resized);
      setWarning(photoWarning(quality));
      setNote(
        resized.size < picked.size
          ? `ย่อรูปแล้ว ${formatBytes(picked.size)} → ${formatBytes(resized.size)}`
          : `ขนาดไฟล์ ${formatBytes(resized.size)}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {required ? '*' : ''}
      </label>

      {preview && (
        <div className="photo-preview">
          <img src={preview} alt={`ตัวอย่าง${label}`} />
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => {
              onPick(null);
              setNote('');
              setWarning(null);
              const el = document.getElementById(id) as HTMLInputElement | null;
              if (el) el.value = '';
            }}
          >
            เลือกรูปใหม่
          </button>
        </div>
      )}

      <input
        id={id}
        type="file"
        accept="image/*"
        onChange={(e) => void handle(e.target.files?.[0])}
      />

      {warning && <div className="hint hint-warn">{warning}</div>}
      <div className="hint">{busy ? 'กำลังเตรียมรูป...' : note || hint}</div>
    </div>
  );
}
