'use client';

import { PackageOpen } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import BorrowerDetail from './BorrowerDetail';
import LendDialog from './LendDialog';
import type { BorrowerFull } from '@/app/lib/types';

/**
 * A borrower opened on their own, with no request pending on them — which is
 * also where lending happens now. The staff member is already looking at the
 * person, their contact details and everything they have borrowed before;
 * choosing the equipment from here is one dialog rather than a separate page
 * that asks them to find the same person again.
 */
export default function BorrowerPage({ borrowerId }: { borrowerId: string }) {
  // Reached from a loan record as often as from the lend page, so the back
  // link follows whoever sent us rather than always guessing one of them.
  const from = useSearchParams().get('from');
  const backHref = from === 'history' ? '/staff/history' : '/staff/lend';

  const [borrower, setBorrower] = useState<BorrowerFull | null>(null);
  const [lending, setLending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const name = borrower ? `${borrower.first_name} ${borrower.last_name}` : '';

  return (
    <>
      <BorrowerDetail
        borrowerId={borrowerId}
        backHref={backHref}
        refreshKey={refreshKey}
        onLoaded={setBorrower}
        actions={
          borrower && (
            <button className="btn btn-primary btn-with-icon" onClick={() => setLending(true)}>
              <PackageOpen size={18} />
              จ่ายอุปกรณ์ให้ผู้ยืมรายนี้
            </button>
          )
        }
      />
      {lending && borrower && (
        <LendDialog
          borrowerId={borrowerId}
          borrowerName={name}
          onClose={() => setLending(false)}
          onDone={() => {
            setLending(false);
            // The loan list on this page just gained a row, and the borrower's
            // on-time rate is computed from it.
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}
