'use client';

import BorrowerDetail from './BorrowerDetail';

/** A borrower opened on their own, with no request pending on them. */
export default function BorrowerPage({ borrowerId }: { borrowerId: string }) {
  return <BorrowerDetail borrowerId={borrowerId} backHref="/staff/history" />;
}
