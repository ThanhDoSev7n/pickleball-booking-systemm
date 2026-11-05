'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface PollingOptions {
  /** 0 = khong tu dong lam mới */
  intervalMs?: number;
  enabled?: boolean;
  /** Doi thi fetch lai ngay (nên truyền giá trị primitive) */
  deps?: unknown[];
}

export interface PollingState<T> {
  data: T | null;
  error: unknown | null;
  /** Lan dau tien chua co du lieu */
  loading: boolean;
  /** Lam mới giua cac lan, khong doi skeleton */
  refreshing: boolean;
  hasLoaded: boolean;
  lastUpdatedAt: number | null;
  refresh: () => Promise<void>;
  setData: (updater: T | ((current: T | null) => T)) => void;
}

/** SWR-style polling tu viet: fetch + setInterval + refresh thu cong, khong dung thu vien. */
export function usePolling<T>(fetcher: () => Promise<T>, options: PollingOptions = {}): PollingState<T> {
  const { intervalMs = 0, enabled = true, deps = [] } = options;

  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<unknown | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const requestId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (!mounted.current || id !== requestId.current) return;
      setDataState(result);
      setError(null);
      setLastUpdatedAt(Date.now());
      setHasLoaded(true);
    } catch (caught) {
      if (!mounted.current || id !== requestId.current) return;
      setError(caught);
    } finally {
      if (mounted.current && id === requestId.current) setRefreshing(false);
    }
  }, []);

  const queryKey = deps.map((value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value ?? null))).join('~');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Fetch khoi dong o microtask de render hien tai khong bi setState dong bo
    queueMicrotask(() => {
      if (!cancelled) void run();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, queryKey, run]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void run();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, run]);

  const setData = useCallback((updater: T | ((current: T | null) => T)) => {
    setDataState((current) => (typeof updater === 'function' ? (updater as (c: T | null) => T)(current) : updater));
  }, []);

  return {
    data,
    error,
    loading: enabled && !hasLoaded && error === null,
    refreshing,
    hasLoaded,
    lastUpdatedAt,
    refresh: run,
    setData,
  };
}

const listeners = new Set<() => void>();
let clockValue = 0;
let clockTimer: number | null = null;

function tick() {
  clockValue = Date.now();
  listeners.forEach((emit) => emit());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (clockTimer === null) {
    clockValue = Date.now();
    clockTimer = window.setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/** Dong ho dung cho dem nguoc: 1 setInterval duyet toan bo component, khong tao cac timer rieng. */
export function useNowMs(): number {
  return useSyncExternalStore(subscribe, () => clockValue, () => 0);
}
