'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import BorrowerSearch from './BorrowerSearch';
import RegisterForm from './RegisterForm';

/**
 * Lending starts from the person, not from a form. Either they have borrowed
 * before — pick them off the list — or they are new and get registered here;
 * both end up on the same borrower page, where the equipment is chosen and
 * handed over. The old flow made staff register someone, navigate away, and
 * then search for the name they had just typed in.
 */
export default function LendTab() {
  const router = useRouter();
  const params = useSearchParams();
  const registering = params.get('tab') === 'new';

  const openBorrower = (borrowerId: string) => router.push(`/staff/borrowers/${borrowerId}`);

  return (
    <div className="card">
      <h1>บันทึกการยืม</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
        เลือกผู้ยืม แล้วจ่ายอุปกรณ์จากหน้าของเขา · ผู้ยืมรายใหม่ต้องลงทะเบียนก่อน
      </p>

      <div className="filter-row">
        <button
          className={`btn btn-sm ${registering ? 'btn-outline' : 'btn-primary'}`}
          onClick={() => router.replace('/staff/lend')}
        >
          ผู้ยืมเดิม
        </button>
        <button
          className={`btn btn-sm ${registering ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => router.replace('/staff/lend?tab=new')}
        >
          ลงทะเบียนผู้ยืมใหม่
        </button>
      </div>

      {registering ? (
        <RegisterForm onRegistered={(b) => openBorrower(b.borrower_id)} />
      ) : (
        <BorrowerSearch onPick={(b) => openBorrower(b.borrower_id)} pickLabel="จ่ายอุปกรณ์" />
      )}
    </div>
  );
}
