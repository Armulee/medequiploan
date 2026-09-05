import Link from 'next/link';

/** What a staff account sees if it types an admin URL. */
export default function AdminOnly() {
  return (
    <div className="card">
      <h1>เฉพาะแอดมิน</h1>
      <div className="empty-state">
        หน้านี้เปิดให้เฉพาะบัญชีแอดมิน
        <div style={{ marginTop: 10 }}>
          <Link className="btn btn-sm btn-outline" href="/staff">
            กลับหน้าภาพรวม
          </Link>
        </div>
      </div>
    </div>
  );
}
