'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiErrorMessage } from '@/lib/error-message';
import { addCounterService, checkInBooking, createCounterInvoice, createWalkIn, deactivateCounterService, findCounterCustomer, listCounterBookings, listCounterClusters, listCounterServices, updateCounterService, type CounterBooking, type CounterCluster, type CounterCustomer, type CounterInvoice, type CounterService } from '@/lib/api/operations-api';
import { fetchAvailability, type CourtAvailability, type SlotView } from '@/lib/api/availability-api';

const money = (value: number | string | null | undefined) => `${Number(value ?? 0).toLocaleString('vi-VN')} ₫`;

export default function StaffPortalPage() {
  const { user, status, isStaffOrOwner } = useAuth();
  const [bookings, setBookings] = useState<CounterBooking[]>([]);
  const [services, setServices] = useState<CounterService[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<number, number>>({});
  const [bookingId, setBookingId] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [clusters, setClusters] = useState<CounterCluster[]>([]);
  const [clusterId, setClusterId] = useState('');
  const [courtOptions, setCourtOptions] = useState<CourtAvailability[]>([]);
  const [courtId, setCourtId] = useState('');
  const [walkInDate, setWalkInDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10));
  const [customerPhone, setCustomerPhone] = useState('');
  const [walkInCustomer, setWalkInCustomer] = useState<CounterCustomer | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [payment, setPayment] = useState<'CASH'|'CARD'|'TRANSFER'>('CASH');
  const [invoice, setInvoice] = useState<CounterInvoice | null>(null);
  const [notice, setNotice] = useState('');
  const [syncWarning, setSyncWarning] = useState('');
  const [busy, setBusy] = useState(false);
  const [serviceForm, setServiceForm] = useState({ clusterId: '', name: '', unit: 'lượt', price: '' });
  const [editServiceId, setEditServiceId] = useState('');
  const [editServiceForm, setEditServiceForm] = useState({ name: '', unit: '', price: '' });
  const [cameraOn, setCameraOn] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [bookingResult, serviceResult, clusterResult] = await Promise.allSettled([listCounterBookings(), listCounterServices(), listCounterClusters()]);
    const failures: string[] = [];
    if (bookingResult.status === 'fulfilled') setBookings(bookingResult.value.items);
    else failures.push('danh sách booking');
    if (serviceResult.status === 'fulfilled') setServices(serviceResult.value);
    else failures.push('dịch vụ');
    if (clusterResult.status === 'fulfilled') {
      setClusters(clusterResult.value);
      setClusterId((current) => current || String(clusterResult.value[0]?.clusterId ?? ''));
    } else failures.push('cụm sân');
    setSyncWarning(failures.length ? `Chưa tải được ${failures.join(', ')}. Kiểm tra backend và cập nhật database nếu bảng mới chưa được tạo.` : '');
  }, []);
  useEffect(() => { if (status === 'authenticated' && isStaffOrOwner) void refresh(); }, [status, isStaffOrOwner, refresh]);
  useEffect(() => {
    if (status !== 'authenticated' || !isStaffOrOwner) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15_000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [status, isStaffOrOwner, refresh]);

  useEffect(() => {
    if (!clusterId || !walkInDate) { setCourtOptions([]); return; }
    let cancelled = false;
    void fetchAvailability({ date: walkInDate, clusterId: Number(clusterId) }).then((result) => {
      if (cancelled) return;
      setCourtOptions(result.courts);
      setCourtId((current) => result.courts.some((court) => String(court.courtId) === current) ? current : String(result.courts[0]?.courtId ?? ''));
      setSelectedSlots([]);
    }).catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Không tải được lịch sân'); });
    return () => { cancelled = true; };
  }, [clusterId, walkInDate]);

  useEffect(() => { setSelectedSlots([]); }, [courtId]);
  useEffect(() => { if (invoice) document.getElementById('print-invoice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [invoice]);

  const submitCheckIn = useCallback(async (code: string) => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await checkInBooking(code.trim());
      setNotice(result.priceWarning ?? `Check-in thành công · ${result.bookingCode} · Tiền sân ${result.totalAmount && result.totalAmount > 0 ? money(result.totalAmount) : 'chưa có'}`);
      setScanCode('');
      await refresh();
    } catch (error) {
      setNotice(apiErrorMessage(error));
      requestAnimationFrame(() => document.getElementById('staff-notice')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let started = false;
    let handlingScan = false;
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Trình duyệt không hỗ trợ camera. Hãy dùng Chrome/Edge trên localhost hoặc HTTPS.');
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled || !scannerRef.current) return;
      scanner = new Html5Qrcode(scannerRef.current.id, { verbose: false });
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => {
          if (handlingScan) return;
          handlingScan = true;
          setCameraOn(false);
          setScanCode(decodedText);
          void submitCheckIn(decodedText);
        },
        () => undefined,
      );
      started = true;
      if (cancelled && scanner.isScanning) await scanner.stop();
    })().catch((error: unknown) => {
      if (cancelled) return;
      setNotice(error instanceof Error ? error.message : 'Không thể khởi động camera. Hãy kiểm tra quyền camera của trình duyệt.');
      setCameraOn(false);
    });
    return () => {
      cancelled = true;
      if (scanner && started) {
        void scanner.stop().then(() => scanner?.clear()).catch(() => undefined);
      }
    };
  }, [cameraOn, submitCheckIn]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setNotice('');
    try { await action(); } catch (error) {
      setNotice(apiErrorMessage(error));
      requestAnimationFrame(() => document.getElementById('staff-notice')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    finally { setBusy(false); }
  }
  if (status === 'loading') return <p className="p-8 text-slate-600">Đang kiểm tra phiên đăng nhập…</p>;
  if (!user || !isStaffOrOwner) return <section className="mx-auto max-w-xl rounded-2xl border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Cổng lễ tân</h1><p className="mt-3 text-slate-600">Đăng nhập bằng tài khoản nhân viên hoặc chủ sân để tiếp tục.</p><Link className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white" href="/dang-nhap">Đăng nhập</Link></section>;

  const selectedBooking = bookings.find((booking) => String(booking.bookingId) === bookingId);
  const availablePosServices = selectedBooking ? services.filter((service) => service.clusterId === selectedBooking.clusterId) : services;
  const hasSelectedPosService = Object.values(selectedServices).some((quantity) => quantity > 0);
  const canCreateInvoice = Number.isInteger(Number(bookingId)) && Number(bookingId) > 0;

  return <div className="space-y-6">
    <header className="rounded-2xl bg-slate-900 p-6 text-white"><p className="text-sm text-emerald-300">STAFF PORTAL · {user.fullName}</p><h1 className="mt-1 text-3xl font-bold">Vận hành tại quầy</h1><p className="mt-2 text-slate-300">Check-in khách, tạo đặt sân walk-in và lập hóa đơn dịch vụ.</p></header>
    {notice && <div id="staff-notice" role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">{notice}</div>}
    {syncWarning && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{syncWarning}</div>}
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Check-in QR</h2><p className="mt-1 text-sm text-slate-500">Quét QR trên phiếu đặt sân hoặc nhập mã đặt sân.</p>
        <div ref={scannerRef} id="qr-reader" className={`${cameraOn ? 'mt-4 block overflow-hidden rounded-xl' : 'hidden'}`} />
        {cameraOn && <p className="mt-2 text-sm text-emerald-700">Đưa mã QR vào khung camera. Khi đọc được, hệ thống sẽ tự check-in.</p>}
        <div className="mt-4 flex flex-wrap gap-2"><input value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder="Mã QR hoặc PKL-…" className="min-w-0 flex-1 rounded-lg border px-3 py-2"/><button disabled={busy || !scanCode.trim()} onClick={() => void submitCheckIn(scanCode)} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Check-in bằng mã</button></div>
        <button disabled={busy} onClick={() => setCameraOn((value) => !value)} className="mt-3 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">{cameraOn ? 'Tắt camera' : 'Mở camera quét QR'}</button>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Đặt sân walk-in</h2><p className="mt-1 text-sm text-slate-500">Tìm khách bằng số điện thoại, sau đó chọn sân và các khung giờ còn trống.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-sm">Số điện thoại khách<input value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setWalkInCustomer(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void run(async () => setWalkInCustomer(await findCounterCustomer(customerPhone))); } }} className="mt-1 w-full rounded-lg border px-3 py-2" inputMode="tel" placeholder="Ví dụ: 0912 345 678"/></label><button disabled={busy || !customerPhone.trim()} onClick={() => void run(async () => { setWalkInCustomer(await findCounterCustomer(customerPhone)); })} className="self-end rounded-lg border px-4 py-2 font-medium disabled:opacity-50">Tìm khách</button></div>
        {walkInCustomer && <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Đã chọn: <b>{walkInCustomer.fullName}</b> · {walkInCustomer.phoneNumber}</div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-sm">Cụm sân<select value={clusterId} onChange={(e) => { setClusterId(e.target.value); setCourtId(''); }} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">Chọn cụm sân</option>{clusters.map((cluster) => <option key={cluster.clusterId} value={cluster.clusterId}>{cluster.name} · {cluster.city}</option>)}</select></label><label className="text-sm">Ngày chơi<input type="date" min={new Date().toISOString().slice(0, 10)} value={walkInDate} onChange={(e) => setWalkInDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm">Sân<select value={courtId} onChange={(e) => setCourtId(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">Chọn sân</option>{courtOptions.map((court) => <option key={court.courtId} value={court.courtId}>{court.courtName}</option>)}</select></label></div>
        <div className="mt-4"><h3 className="text-sm font-semibold">Khung giờ còn trống <span className="font-normal text-slate-500">(có thể chọn nhiều khung liên tiếp)</span></h3><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{(courtOptions.find((court) => String(court.courtId) === courtId)?.slots ?? []).filter((slot) => slot.availability === 'AVAILABLE').map((slot: SlotView) => { const selected = selectedSlots.includes(slot.slotId); return <button type="button" key={slot.slotId} onClick={() => setSelectedSlots((current) => selected ? current.filter((id) => id !== slot.slotId) : [...current, slot.slotId])} className={`rounded-lg border px-3 py-2 text-sm font-medium ${selected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 hover:border-brand-500'}`}>{new Date(slot.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}–{new Date(slot.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</button>; })}</div>{courtId && !(courtOptions.find((court) => String(court.courtId) === courtId)?.slots.some((slot) => slot.availability === 'AVAILABLE')) && <p className="mt-2 text-sm text-slate-500">Ngày này không còn khung giờ trống ở sân đã chọn.</p>}</div>
        {selectedSlots.length > 0 && <p className="mt-3 text-sm text-slate-600">Đã chọn {selectedSlots.length} khung giờ.</p>}
        <button disabled={busy || !walkInCustomer || !selectedSlots.length} onClick={() => void run(async () => { const result = await createWalkIn({ customerUserId: walkInCustomer!.userId, slotIds: selectedSlots }); setNotice(`Đã tạo booking ${result.bookingCode} cho ${walkInCustomer!.fullName}`); setBookingId(String(result.bookingId)); setSelectedSlots([]); setWalkInCustomer(null); setCustomerPhone(''); await refresh(); })} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Tạo booking tại quầy</button>
      </section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Danh sách booking</h2><p className="text-sm text-slate-500">Booking online đủ điều kiện sẽ xuất hiện tự động trong tối đa 15 giây.</p></div><button onClick={() => void refresh()} className="rounded-lg border px-3 py-2 text-sm font-medium">Làm mới</button></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Mã booking</th><th className="p-3">Thời gian</th><th className="p-3">Trạng thái</th><th className="p-3">Tiền sân</th><th className="p-3">Chọn</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.bookingId} className="border-t"><td className="p-3 font-semibold">{booking.bookingCode}</td><td className="p-3">{new Date(booking.startTime).toLocaleString('vi-VN')}</td><td className="p-3">{booking.status}</td><td className="p-3">{booking.totalAmount && booking.totalAmount > 0 ? money(booking.totalAmount) : <span className="text-amber-700">Chưa có giá</span>}</td><td className="p-3"><button onClick={() => setBookingId(String(booking.bookingId))} className="rounded border px-3 py-1">{bookingId === String(booking.bookingId) ? 'Đã chọn' : 'Chọn'}</button></td></tr>)}</tbody></table>{!bookings.length && <p className="p-5 text-center text-slate-500">Chưa có booking trong danh sách.</p>}</div>
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">POS · dịch vụ tại sân</h2><label className="mt-3 block text-sm">Booking<input value={bookingId} onChange={(e) => { setBookingId(e.target.value); setSelectedServices({}); }} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Chọn booking trong danh sách bên trên"/></label>
        <div className="mt-4 space-y-2">{availablePosServices.map((service) => <label key={service.serviceId} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span><b>{service.name}</b><span className="ml-2 text-slate-500">{money(service.price)} / {service.unit}</span></span><input type="number" min="0" value={selectedServices[service.serviceId] ?? 0} onChange={(e) => setSelectedServices((prev) => ({ ...prev, [service.serviceId]: Math.max(0, Number(e.target.value)) }))} className="w-20 rounded border px-2 py-1"/></label>)}{!services.length && <p className="text-sm text-slate-500">Chưa có dịch vụ. Thêm dịch vụ bên dưới.</p>}{services.length > 0 && selectedBooking && !availablePosServices.length && <p className="text-sm text-amber-700">Cụm sân này chưa có dịch vụ đang hoạt động. Hãy cấu hình dịch vụ cho đúng cụm sân.</p>}{services.length > 0 && !selectedBooking && <p className="text-sm text-slate-500">Chọn một booking trong danh sách để hiển thị dịch vụ đúng cụm sân.</p>}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><select value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)} className="rounded-lg border px-3 py-2"><option value="CASH">Tiền mặt</option><option value="CARD">Thẻ</option><option value="TRANSFER">Chuyển khoản</option></select><button disabled={busy || !canCreateInvoice} onClick={() => void run(async () => { const result = await createCounterInvoice({ bookingId: Number(bookingId), paymentMethod: payment, items: Object.entries(selectedServices).filter(([, quantity]) => quantity > 0).map(([serviceId, quantity]) => ({ serviceId: Number(serviceId), quantity })) }); setInvoice(result); setSelectedServices({}); setNotice(`Đã lập hóa đơn ${result.invoiceCode}`); await refresh(); })} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Thanh toán & lập hóa đơn</button></div>
        {!busy && !canCreateInvoice && <p className="mt-2 text-sm text-slate-500">Chọn booking trước. Dịch vụ là tùy chọn; nếu không chọn dịch vụ, hóa đơn chỉ thu tiền sân.</p>}
        {!busy && canCreateInvoice && !hasSelectedPosService && <p className="mt-2 text-sm text-slate-500">Hóa đơn sẽ chỉ gồm tiền sân của booking.</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Cấu hình dịch vụ</h2><p className="mt-1 text-sm text-slate-500">Tạo danh mục thuê vợt, bóng, nước uống… cho một cụm sân.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><select aria-label="Cụm sân áp dụng" value={serviceForm.clusterId} onChange={(e) => setServiceForm({ ...serviceForm, clusterId: e.target.value })} className="rounded-lg border bg-white px-3 py-2"><option value="">Chọn cụm sân</option>{clusters.map((cluster) => <option key={cluster.clusterId} value={cluster.clusterId}>{cluster.name}</option>)}</select><input aria-label="Tên dịch vụ" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} className="rounded-lg border px-3 py-2" placeholder="Tên dịch vụ"/><input aria-label="Đơn vị" value={serviceForm.unit} onChange={(e) => setServiceForm({ ...serviceForm, unit: e.target.value })} className="rounded-lg border px-3 py-2" placeholder="Đơn vị (chai, lượt…)"/><input aria-label="Giá dịch vụ" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} className="rounded-lg border px-3 py-2" placeholder="Giá VND" inputMode="decimal"/></div><button disabled={busy || !serviceForm.clusterId || !serviceForm.name.trim() || !serviceForm.price} onClick={() => void run(async () => { await addCounterService({ clusterId: Number(serviceForm.clusterId), name: serviceForm.name, unit: serviceForm.unit, price: Number(serviceForm.price) }); setServiceForm({ clusterId: '', name: '', unit: 'lượt', price: '' }); await refresh(); setNotice('Đã thêm dịch vụ'); })} className="mt-3 rounded-lg border border-brand-600 px-4 py-2 font-semibold text-brand-700 disabled:opacity-50">Thêm dịch vụ</button><div className="mt-5 space-y-2">{services.map((service) => <div key={service.serviceId} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span><b>{service.name}</b><span className="ml-2 text-slate-500">{money(service.price)} · cụm #{service.clusterId}</span></span><button disabled={busy} onClick={() => void run(async () => { await deactivateCounterService(service.serviceId); await refresh(); setNotice('Đã ngừng cung cấp dịch vụ'); })} className="rounded border px-2 py-1 text-xs text-red-700">Ngừng</button></div>)}</div></section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Chỉnh sửa dịch vụ có sẵn</h2><p className="mt-1 text-sm text-slate-500">Đổi tên, đơn vị hoặc giá; hóa đơn đã lập vẫn giữ giá tại thời điểm bán.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><select aria-label="Chọn dịch vụ cần sửa" value={editServiceId} onChange={(e) => { const service = services.find((item) => String(item.serviceId) === e.target.value); setEditServiceId(e.target.value); setEditServiceForm(service ? { name: service.name, unit: service.unit, price: String(service.price) } : { name: '', unit: '', price: '' }); }} className="rounded-lg border bg-white px-3 py-2"><option value="">Chọn dịch vụ</option>{services.map((service) => <option key={service.serviceId} value={service.serviceId}>{service.name} · {money(service.price)}</option>)}</select><input aria-label="Tên dịch vụ mới" value={editServiceForm.name} onChange={(e) => setEditServiceForm({ ...editServiceForm, name: e.target.value })} className="rounded-lg border px-3 py-2" placeholder="Tên dịch vụ"/><input aria-label="Đơn vị mới" value={editServiceForm.unit} onChange={(e) => setEditServiceForm({ ...editServiceForm, unit: e.target.value })} className="rounded-lg border px-3 py-2" placeholder="Đơn vị"/><input aria-label="Giá mới" type="number" min="0" value={editServiceForm.price} onChange={(e) => setEditServiceForm({ ...editServiceForm, price: e.target.value })} className="rounded-lg border px-3 py-2" placeholder="Giá VND"/></div><div className="mt-3 flex gap-2"><button disabled={busy || !editServiceId || !editServiceForm.name.trim() || !editServiceForm.unit.trim() || editServiceForm.price === ''} onClick={() => void run(async () => { await updateCounterService(Number(editServiceId), { name: editServiceForm.name, unit: editServiceForm.unit, price: Number(editServiceForm.price) }); await refresh(); setNotice('Đã cập nhật tên và giá dịch vụ'); })} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Lưu thay đổi</button><button onClick={() => { setEditServiceId(''); setEditServiceForm({ name: '', unit: '', price: '' }); }} className="rounded-lg border px-4 py-2">Hủy</button></div></section>
    {invoice && <section id="print-invoice" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">PHIẾU THANH TOÁN</p><h2 className="text-2xl font-bold">{invoice.invoiceCode}</h2><p className="text-sm text-slate-500">Booking #{invoice.bookingId} · {invoice.paymentMethod}</p></div><button onClick={() => window.print()} className="rounded-lg border px-4 py-2 print:hidden">In hóa đơn</button></div><div className="mt-4 divide-y"><div className="flex justify-between py-2"><span>Tiền sân</span><span>{money(invoice.courtAmount)}</span></div>{invoice.items.map((item, i) => <div key={`${item.serviceName}-${i}`} className="flex justify-between py-2"><span>{item.serviceName} × {item.quantity}</span><span>{money(item.subtotal)}</span></div>)}</div><div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Tổng cộng</span><span>{money(invoice.total)}</span></div></section>}
    <style jsx global>{`@media print { body * { visibility: hidden; } #print-invoice, #print-invoice * { visibility: visible; } #print-invoice { position: absolute; inset: 0; width: 100%; border: 0; box-shadow: none; } }`}</style>
  </div>;
}
