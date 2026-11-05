import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AvailabilityBoard } from '@/components/availability-board';

interface Props {
  params: Promise<{ courtId: string }>;
}

// Route co params dong + Navbar dung usePathname -> opt-out de duoc render theo request
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courtId } = await params;
  return { title: `Chi tiết sân ${courtId} · Đặt Sân Pickleball` };
}

export default async function CourtDetailPage({ params }: Props) {
  const { courtId } = await params;
  const id = Number(courtId);
  if (!Number.isFinite(id) || id <= 0) notFound();

  return (
    <div className="space-y-5">
      <header>
        <nav className="text-sm text-slate-500">
          <Link href="/san" className="text-brand-700 hover:underline">
            Tra cứu sân
          </Link>{' '}
          / Chi tiết sân
        </nav>
        <h1 className="mt-1 text-2xl font-bold text-slate-800 sm:text-3xl">Khung giờ của sân #{id}</h1>
        <p className="mt-1 text-sm text-slate-500">Chọn khung giờ còn trống, giữ chỗ 5 phút rồi xác nhận đặt sân.</p>
      </header>
      <AvailabilityBoard courtId={id} />
    </div>
  );
}
