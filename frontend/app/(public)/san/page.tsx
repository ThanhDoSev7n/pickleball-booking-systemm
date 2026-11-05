'use client';

import { AvailabilityBoard } from '@/components/availability-board';

export default function TraCuuSanPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">Tra cứu sân trống</h1>
        <p className="mt-1 text-sm text-slate-500">
          Chọn ngày, thành phố và khung giờ để xem sân còn trống theo thời gian thực. Click vào khung giờ để chọn, sau đó giữ chỗ 5 phút.
        </p>
      </header>
      <AvailabilityBoard />
    </div>
  );
}
