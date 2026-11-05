/**
 * State machine cua slot (muc 4.6.1).
 * AVAILABLE -> LOCKED -> BOOKED -> (tr ve AVAILABLE khi booking bi huy truoc thoi diem bat dau)
 * BLOCKED: san bao tri, khong cho dat.
 */
export enum SlotStatus {
  AVAILABLE = 'AVAILABLE',
  LOCKED = 'LOCKED',
  BOOKED = 'BOOKED',
  BLOCKED = 'BLOCKED',
}

export const FINAL_SLOT_STATUSES: readonly SlotStatus[] = [SlotStatus.BOOKED, SlotStatus.BLOCKED];

/** Cac chuyen trang thai hop le - dung de bat loi o bien dich ngay tu compile/runtime. */
const ALLOWED_TRANSITIONS: Readonly<Record<SlotStatus, readonly SlotStatus[]>> = {
  [SlotStatus.AVAILABLE]: [SlotStatus.LOCKED, SlotStatus.BLOCKED],
  [SlotStatus.LOCKED]: [SlotStatus.AVAILABLE, SlotStatus.BOOKED],
  [SlotStatus.BOOKED]: [SlotStatus.AVAILABLE],
  [SlotStatus.BLOCKED]: [SlotStatus.AVAILABLE],
};

export function canTransitionSlot(from: SlotStatus, to: SlotStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
