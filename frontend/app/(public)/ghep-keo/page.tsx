'use client';

import { useEffect, useState } from 'react';
import { AlertBanner } from '@/components/alert-banner';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/spinner';
import { fetchAvailability } from '@/lib/api/availability-api';
import {
  SKILL_LABELS,
  cancelMatch,
  createMatch,
  joinMatch,
  leaveMatch,
  listMatches,
  type MatchPost,
  type SkillLevel,
} from '@/lib/api/match-api';
import { useAuth } from '@/lib/auth-context';
import { apiErrorMessage } from '@/lib/error-message';
import { usePolling } from '@/lib/use-polling';

const SKILLS = Object.keys(SKILL_LABELS) as SkillLevel[];

export default function GhepKeoPage() {
  const { user, isAuthenticated } = useAuth();
  const [skill, setSkill] = useState<SkillLevel | ''>('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data, error, loading, refresh } = usePolling(() => listMatches(skill || undefined), {
    intervalMs: 30_000,
    deps: [skill],
  });

  const run = async (action: () => Promise<unknown>, okText: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'success', text: okText });
      await refresh();
    } catch (caught) {
      setMessage({ tone: 'error', text: apiErrorMessage(caught) });
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">Ghép kèo</h1>
          <p className="mt-1 text-sm text-slate-500">Tìm người chơi cùng trình độ hoặc đăng bài tìm đối thủ.</p>
        </div>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {showForm ? 'Đóng' : 'Đăng bài tìm kèo'}
          </button>
        ) : null}
      </header>

      {showForm ? (
        <CreateForm
          onDone={async () => {
            setShowForm(false);
            setMessage({ tone: 'success', text: 'Đã đăng bài tìm kèo.' });
            await refresh();
          }}
          onError={(text) => setMessage({ tone: 'error', text })}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={skill === ''} onClick={() => setSkill('')}>
          Tất cả trình độ
        </FilterChip>
        {SKILLS.map((s) => (
          <FilterChip key={s} active={skill === s} onClick={() => setSkill(s)}>
            {SKILL_LABELS[s]}
          </FilterChip>
        ))}
      </div>

      {message ? (
        <AlertBanner tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </AlertBanner>
      ) : null}

      {loading ? <LoadingBlock label="Đang tải danh sách kèo…" /> : null}
      {!loading && error && !data ? <AlertBanner tone="error">{apiErrorMessage(error)}</AlertBanner> : null}

      {!loading && data && data.length === 0 ? (
        <EmptyState title="Chưa có kèo nào" description="Hãy là người đầu tiên đăng bài tìm đối thủ." />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((post) => (
          <MatchCard
            key={post.postId}
            post={post}
            canAct={isAuthenticated}
            isMine={user?.userId === post.creatorId}
            onJoin={() => run(() => joinMatch(post.postId), 'Đã tham gia trận.')}
            onLeave={() => run(() => leaveMatch(post.postId), 'Đã rời trận.')}
            onCancel={() => run(() => cancelMatch(post.postId), 'Đã huỷ bài đăng.')}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
        active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

interface MatchCardProps {
  post: MatchPost;
  canAct: boolean;
  isMine: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
}

function MatchCard({ post, canAct, isMine, onJoin, onLeave, onCancel }: MatchCardProps) {
  const full = post.status === 'FULL';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800">{post.clusterName}</p>
          <p className="text-sm text-slate-500">
            {post.playDate} · {post.startTime} - {post.endTime}
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
          {SKILL_LABELS[post.skillLevel]}
        </span>
      </div>
      {post.description ? <p className="mt-2 text-sm text-slate-600">{post.description}</p> : null}
      <p className="mt-2 text-sm text-slate-500">
        Người đăng: {post.creatorName} · Đã có {post.joinedCount}/{post.playersNeeded} người
        {full ? ' (đã đủ)' : ''}
      </p>
      {canAct ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {isMine ? (
            <button type="button" onClick={onCancel} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
              Huỷ bài đăng
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onJoin}
                disabled={full}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Tham gia
              </button>
              <button type="button" onClick={onLeave} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Rời trận
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Đăng nhập để tham gia.</p>
      )}
    </div>
  );
}

function CreateForm({ onDone, onError }: { onDone: () => Promise<void>; onError: (text: string) => void }) {
  const [clusters, setClusters] = useState<{ id: number; name: string }[]>([]);
  const [clusterId, setClusterId] = useState<number | ''>('');
  const [playDate, setPlayDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('20:00');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('BEGINNER');
  const [playersNeeded, setPlayersNeeded] = useState(1);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  // Lay danh sach cum san tu API tra cuu san (cong khai).
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setPlayDate(today);
    fetchAvailability({ date: today })
      .then((result) => {
        const map = new Map<number, string>();
        result.courts.forEach((c) => map.set(c.clusterId, c.clusterName));
        const list = Array.from(map, ([id, name]) => ({ id, name }));
        setClusters(list);
        if (list.length > 0) setClusterId(list[0].id);
      })
      .catch(() => setClusters([]));
  }, []);

  const submit = async () => {
    if (clusterId === '') return;
    setBusy(true);
    try {
      await createMatch({
        clusterId,
        playDate,
        startTime,
        endTime,
        skillLevel,
        playersNeeded,
        description: description || undefined,
      });
      await onDone();
    } catch (caught) {
      onError(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      <label className="text-sm text-slate-600">
        Cụm sân
        <select className={inputClass} value={clusterId} onChange={(e) => setClusterId(Number(e.target.value))}>
          {clusters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-slate-600">
        Ngày chơi
        <input type="date" className={inputClass} value={playDate} onChange={(e) => setPlayDate(e.target.value)} />
      </label>
      <label className="text-sm text-slate-600">
        Giờ bắt đầu
        <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </label>
      <label className="text-sm text-slate-600">
        Giờ kết thúc
        <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </label>
      <label className="text-sm text-slate-600">
        Trình độ
        <select className={inputClass} value={skillLevel} onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}>
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {SKILL_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-slate-600">
        Cần thêm (người)
        <input
          type="number"
          min={1}
          max={10}
          className={inputClass}
          value={playersNeeded}
          onChange={(e) => setPlayersNeeded(Number(e.target.value))}
        />
      </label>
      <label className="text-sm text-slate-600 sm:col-span-2">
        Ghi chú
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || clusterId === ''}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Đang đăng…' : 'Đăng bài'}
        </button>
      </div>
    </div>
  );
}