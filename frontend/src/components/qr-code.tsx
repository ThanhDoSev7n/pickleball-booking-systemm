'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export interface QrCodeProps {
  value: string;
  size?: number;
  caption?: string;
}

interface Generated {
  key: string;
  url: string | null;
  failed: boolean;
}

/** Backend co the tra data URL san hoac chu thô - ve PNG bang lib qrcode. */
export function QrCode({ value, size = 192, caption = 'Mã QR check-in' }: QrCodeProps) {
  const [generated, setGenerated] = useState<Generated>({ key: '', url: null, failed: false });

  useEffect(() => {
    let alive = true;
    if (!value || value.startsWith('data:image')) return;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (alive) setGenerated({ key: value, url, failed: false });
      })
      .catch(() => {
        if (alive) setGenerated({ key: value, url: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  const isDataUrl = value.startsWith('data:image');
  const current = generated.key === value ? generated : { key: value, url: null, failed: false };
  const source = isDataUrl ? value : current.url;

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
      {source ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} width={size} height={size} alt={`${caption}: ${value}`} className="rounded bg-white" />
      ) : (
        <div className="grid place-items-center rounded border border-dashed border-slate-300 px-4 text-center text-xs text-slate-500" style={{ width: size, height: size }}>
          {!value || current.failed ? 'Chưa có mã QR. Lễ tân sẽ tra cứu theo mã đặt sân.' : 'Đang tạo mã QR…'}
        </div>
      )}
      <p className="text-xs font-medium text-slate-500">{caption}</p>
    </div>
  );
}
