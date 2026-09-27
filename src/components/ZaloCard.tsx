/**
 * Lời mời vào nhóm Zalo của lớp. Nút bấm đi qua /zalo để ghi lại ai đã bấm;
 * mã QR mã hoá thẳng link mời, cho người đang xem trên máy tính quét bằng điện
 * thoại (lượt quét thì không ghi nhận được).
 *
 * `qrSvg` là SVG do thư viện qrcode sinh ra ở server từ link admin đã nhập —
 * không chứa gì người chơi nhập vào, nên chèn thẳng được.
 */
export default function ZaloCard({ qrSvg, clicked }: { qrSvg: string; clicked: boolean }) {
  if (clicked) {
    return (
      <p className="coach-note" style={{ margin: 0 }}>
        Nhóm Zalo của lớp:{' '}
        <a href="/zalo" target="_blank" rel="noreferrer">
          mở lại nhóm
        </a>
      </p>
    );
  }

  return (
    <div className="zalo-card">
      <div>
        <h3 className="card-title">Vào nhóm Zalo của lớp</h3>
        <p>
          Nhắc lịch Trạm hoa, link phòng họp, và chỗ để cả lớp nhắc nhau giữ vườn chung được nắng. Bấm
          nút là mở thẳng Zalo.
        </p>
        <a href="/zalo" target="_blank" rel="noreferrer" className="btn-primary">
          Vào nhóm Zalo
        </a>
      </div>
      <div className="zalo-qr" aria-label="Mã QR vào nhóm Zalo" dangerouslySetInnerHTML={{ __html: qrSvg }} />
    </div>
  );
}
