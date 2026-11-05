'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  confirmBooking as apiConfirm,
  lockSlots,
  releaseSlot as apiReleaseSlot,
  type BookingDetail,
  type LockResult,
} from './api/booking-api';
import { isSlotTakenError, takenSlotIdOf } from './error-message';


export interface CartSlot {
  slotId: number;
  courtId: number;
  courtName: string;
  courtType: string;
  clusterId: number;
  clusterName: string;
  city: string;
  startTime: string;
  endTime: string;
}

export interface HeldSlot extends CartSlot {
  lockExpiresAt: string;
}

export type ToggleResult = { ok: true } | { ok: false; reason: 'CROSS_COURT' | 'HELD_BY_ME' };
export type LockOutcome = { ok: true; result: LockResult } | { ok: false; error: unknown };
export type ConfirmOutcome = { ok: true; booking: BookingDetail } | { ok: false; error: unknown };

export interface BookingCartContextValue {
  selection: CartSlot[];
  held: HeldSlot[];
  lockExpiresAt: string | null;
  lockExpiresAtMs: number | null;
  ttlMs: number;
  selectedCount: number;
  heldCount: number;
  selectedCourtId: number | null;
  lockedSlotIds: Set<number>;
  heldSlotIds: Set<number>;
  locking: boolean;
  confirming: boolean;
  releasing: boolean;
  /** Tang len khi giu cho tu dong het han - trang slot lang nghe de refresh luoi */
  expirySignal: number;
  lastConfirmed: BookingDetail | null;
  toggleSlot: (slot: CartSlot) => ToggleResult;
  isSelected: (slotId: number) => boolean;
  clearSelection: () => void;
  lockSelection: () => Promise<LockOutcome>;
  releaseAll: () => Promise<void>;
  releaseOne: (slotId: number) => Promise<{ ok: boolean; error?: unknown }>;
  confirm: (note?: string, expectedTotalAmount?: number | null) => Promise<ConfirmOutcome>;
  dismissConfirmed: () => void;
}

const CART_KEY = 'datsanpick.cart';

const BookingCartContext = createContext<BookingCartContextValue | null>(null);

interface PersistedCart {
  selection: CartSlot[];
  held: HeldSlot[];
  lockExpiresAt: string | null;
}

const byStart = (a: CartSlot, b: CartSlot) => a.startTime.localeCompare(b.startTime);

export function BookingCartProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<CartSlot[]>([]);
  const [held, setHeld] = useState<HeldSlot[]>([]);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [ttlMs, setTtlMs] = useState(5 * 60 * 1000);
  const [locking, setLocking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [expirySignal, setExpirySignal] = useState(0);
  const [lastConfirmed, setLastConfirmed] = useState<BookingDetail | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Tai lai giu cho sau khi F5: server van giu slot, frontend can de hien den hom dem
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      let restored: PersistedCart | null = null;
      let expired = false;
      try {
        const raw = window.localStorage.getItem(CART_KEY);
        if (raw) {
          restored = JSON.parse(raw) as PersistedCart;
          const expiresMs = restored.lockExpiresAt ? new Date(restored.lockExpiresAt).getTime() : 0;
          expired = expiresMs <= Date.now();
          if (expired) window.localStorage.removeItem(CART_KEY);
        }
      } catch {
        window.localStorage.removeItem(CART_KEY);
      }
      if (cancelled) return;
      if (restored && !expired) {
        setSelection(restored.selection ?? []);
        setHeld(restored.held ?? []);
        setLockExpiresAt(restored.lockExpiresAt);
      } else if (expired) {
        setExpirySignal((value) => value + 1);
      }
      setHydrated(true);
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!held.length) {
      window.localStorage.removeItem(CART_KEY);
      return;
    }
    const payload: PersistedCart = { selection, held, lockExpiresAt };
    window.localStorage.setItem(CART_KEY, JSON.stringify(payload));
  }, [selection, held, lockExpiresAt, hydrated]);

  const clearHeld = useCallback(() => {
    setHeld([]);
    setLockExpiresAt(null);
    setSelection([]);
  }, []);

  const expireNow = useCallback(() => {
    clearHeld();
    setExpirySignal((value) => value + 1);
  }, [clearHeld]);

  // Het 5 phut tu dong xa giu cho + tang expirySignal de trang slot refresh
  useEffect(() => {
    if (!lockExpiresAt) return;
    const remaining = new Date(lockExpiresAt).getTime() - Date.now();
    const timer = window.setTimeout(expireNow, Math.max(0, remaining) + 400);
    return () => window.clearTimeout(timer);
  }, [lockExpiresAt, expireNow]);

  const toggleSlot = useCallback(
    (slot: CartSlot): ToggleResult => {
      if (held.some((item) => item.slotId === slot.slotId)) return { ok: false, reason: 'HELD_BY_ME' };
      const exists = selection.some((item) => item.slotId === slot.slotId);
      // Chi cho chon slot cung mot san
      if (!exists && selection.length > 0 && selection[0].courtId !== slot.courtId) {
        return { ok: false, reason: 'CROSS_COURT' };
      }
      setSelection((current) => {
        if (current.some((item) => item.slotId === slot.slotId)) return current.filter((item) => item.slotId !== slot.slotId);
        return [...current, slot].sort(byStart);
      });
      return { ok: true };
    },
    [held, selection],
  );

  const isSelected = useCallback((slotId: number) => selection.some((item) => item.slotId === slotId), [selection]);

  const clearSelection = useCallback(() => setSelection([]), []);

  const lockSelection = useCallback(async (): Promise<LockOutcome> => {
    if (!selection.length) return { ok: false, error: new Error('EMPTY_SELECTION') };
    setLocking(true);
    try {
      const result = await lockSlots(selection.map((item) => item.slotId));
      const lockedIds = new Set(result.lockedSlots.map((item) => item.slotId));
      setHeld((current) => {
        const kept = current.filter((item) => !lockedIds.has(item.slotId));
        const added = selection
          .filter((item) => lockedIds.has(item.slotId))
          .map<HeldSlot>((item) => ({
            ...item,
            lockExpiresAt: result.lockExpiresAt,
          }));
        return [...kept, ...added].sort(byStart);
      });
      setSelection((current) => current.filter((item) => !lockedIds.has(item.slotId)));
      setLockExpiresAt(result.lockExpiresAt);
      setTtlMs(Math.max(1, result.ttlMinutes) * 60 * 1000);
      return { ok: true, result };
    } catch (error) {
      // 409 kem details.slotId: bo ngay slot da bi nguoi khac gianh ra khoi selection.
      if (isSlotTakenError(error)) {
        const takenId = takenSlotIdOf(error);
        if (takenId !== null) {
          setSelection((current) => current.filter((item) => item.slotId !== takenId));
        }
      }
      return { ok: false, error };
    } finally {
      setLocking(false);
    }
  }, [selection]);

  const releaseOne = useCallback(async (slotId: number) => {
    try {
      await apiReleaseSlot(slotId);
      setHeld((current) => {
        const next = current.filter((item) => item.slotId !== slotId);
        if (!next.length) setLockExpiresAt(null);
        return next;
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }, []);

  const releaseAll = useCallback(async () => {
    setReleasing(true);
    try {
      await Promise.allSettled(held.map((item) => apiReleaseSlot(item.slotId)));
      clearHeld();
      setExpirySignal((value) => value + 1);
    } finally {
      setReleasing(false);
    }
  }, [held, clearHeld]);

  const confirm = useCallback(
    async (note?: string, expectedTotalAmount?: number | null): Promise<ConfirmOutcome> => {
      if (!held.length) return { ok: false, error: new Error('EMPTY_HELD') };
      setConfirming(true);
      try {
        const booking = await apiConfirm({
          slotIds: held.map((item) => item.slotId),
          note: note?.trim() || undefined,
          expectedTotalAmount: expectedTotalAmount ?? undefined,
        });
        clearHeld();
        setLastConfirmed(booking);
        setExpirySignal((value) => value + 1);
        return { ok: true, booking };
      } catch (error) {
        return { ok: false, error };
      } finally {
        setConfirming(false);
      }
    },
    [held, clearHeld],
  );

  const dismissConfirmed = useCallback(() => setLastConfirmed(null), []);

  const lockExpiresAtMs = lockExpiresAt ? new Date(lockExpiresAt).getTime() : null;
  const heldSlotIds = useMemo(() => new Set(held.map((item) => item.slotId)), [held]);
  const lockedSlotIds = useMemo(
    () => new Set([...heldSlotIds, ...selection.map((item) => item.slotId)]),
    [heldSlotIds, selection],
  );

  const value = useMemo<BookingCartContextValue>(
    () => ({
      selection,
      held,
      lockExpiresAt,
      lockExpiresAtMs,
      ttlMs,
      selectedCount: selection.length,
      heldCount: held.length,
      selectedCourtId: selection[0]?.courtId ?? null,
      lockedSlotIds,
      heldSlotIds,
      locking,
      confirming,
      releasing,
      expirySignal,
      lastConfirmed,
      toggleSlot,
      isSelected,
      clearSelection,
      lockSelection,
      releaseAll,
      releaseOne,
      confirm,
      dismissConfirmed,
    }),
    [
      selection,
      held,
      lockExpiresAt,
      lockExpiresAtMs,
      ttlMs,
      lockedSlotIds,
      heldSlotIds,
      locking,
      confirming,
      releasing,
      expirySignal,
      lastConfirmed,
      toggleSlot,
      isSelected,
      clearSelection,
      lockSelection,
      releaseAll,
      releaseOne,
      confirm,
      dismissConfirmed,
    ],
  );

  return <BookingCartContext.Provider value={value}>{children}</BookingCartContext.Provider>;
}

export function useBookingCart(): BookingCartContextValue {
  const context = useContext(BookingCartContext);
  if (!context) throw new Error('useBookingCart phai duoc goi ben trong BookingCartProvider');
  return context;
}
