import React from 'react';
import { Paperclip, Image as ImageIcon, Video, FileText, Mic, MapPin, User, BarChart2 } from 'lucide-react';
import { api } from '../backend/api';

export type DealCommentAttachment = {
  type?: string;
  kind?: string;
  url?: string;
  storageKey?: string;
  title?: string;
  mime?: string;
  fileName?: string;
  durationSec?: number;
  size?: number;
  tgMessageId?: number;
};

const TG_STATIC_KINDS = new Set(['location', 'venue', 'contact', 'poll']);

/** Не отдаём в UI прямые CDN-ссылки Meta/Telegram — только storage / API. */
function isBlockedExternalMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h.includes('facebook') || h.includes('fbcdn') || h.includes('fbsbx')) return true;
    if (h.includes('instagram') || h.includes('cdninstagram')) return true;
    if (h.includes('telegram') || h === 't.me' || h.endsWith('.t.me')) return true;
    return false;
  } catch {
    return true;
  }
}

function iconForType(t?: string, kind?: string) {
  const s = ((kind || t) || '').toLowerCase();
  if (s.includes('image') || s === 'ig_reel' || s === 'share' || s === 'sticker') return ImageIcon;
  if (s.includes('video') || s === 'video_note') return Video;
  if (s.includes('audio') || s === 'voice') return Mic;
  return Paperclip;
}

function formatDuration(sec?: number) {
  if (sec == null || Number.isNaN(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

function TgStaticAttachment({ item }: { item: DealCommentAttachment }) {
  const kind = (item.kind || '').toLowerCase();
  if (kind === 'contact') {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium dark:border-white/20 dark:bg-black/20">
        <User size={14} className="shrink-0 opacity-80" />
        <span className="truncate">{item.title || 'Контакт'}</span>
      </span>
    );
  }
  if (kind === 'poll') {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium dark:border-white/20 dark:bg-black/20">
        <BarChart2 size={14} className="shrink-0 opacity-80" />
        <span className="truncate">Опрос</span>
      </span>
    );
  }
  if (kind === 'venue') {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium dark:border-white/20 dark:bg-black/20">
        <MapPin size={14} className="shrink-0 opacity-80" />
        <span className="truncate">Место</span>
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium dark:border-white/20 dark:bg-black/20">
      <MapPin size={14} className="shrink-0 opacity-80" />
      <span className="truncate">Геолокация</span>
    </span>
  );
}

function StorageMediaAttachment({ dealId, item }: { dealId: string; item: DealCommentAttachment }) {
  const sk = item.storageKey;
  const kind = (item.kind || 'file').toLowerCase();
  const mime = (item.mime || '').toLowerCase();
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(false);

  React.useEffect(() => {
    if (!sk) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(false);
    setMediaUrl(null);
    void (async () => {
      try {
        const { url } = await api.deals.getMediaSignedUrl(dealId, sk);
        if (cancelled) return;
        setMediaUrl(url);
      } catch {
        if (!cancelled) setErr(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId, sk]);

  if (!sk) return null;

  const label =
    item.fileName ||
    item.title ||
    (kind === 'voice' ? 'Голосовое' : kind === 'video_note' ? 'Видеосообщение' : kind === 'sticker' ? 'Стикер' : 'Вложение');
  const chipClass =
    'inline-flex max-w-full flex-col gap-1 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium text-inherit dark:border-white/20 dark:bg-black/20';

  if (loading) {
    return (
      <div className={chipClass}>
        <span className="opacity-70">Загрузка…</span>
      </div>
    );
  }
  if (err || !mediaUrl) {
    return (
      <div className={chipClass}>
        <span className="text-rose-600/90 dark:text-rose-400/90">Не удалось загрузить</span>
      </div>
    );
  }

  const isImg =
    kind === 'image' ||
    kind === 'sticker' ||
    (item.type || '').toLowerCase().includes('image') ||
    mime.startsWith('image/');
  const isAud = kind === 'voice' || kind === 'audio' || mime.startsWith('audio/');
  const isVid = kind === 'video' || kind === 'video_note' || mime.startsWith('video/');

  if (isImg) {
    return (
      <div className={chipClass}>
        <img src={mediaUrl} alt="" className="max-h-48 max-w-full rounded-md object-contain" />
        {item.durationSec != null ? (
          <span className="text-[10px] opacity-80">{formatDuration(item.durationSec)}</span>
        ) : null}
      </div>
    );
  }

  if (isAud) {
    return (
      <div className={chipClass}>
        <audio src={mediaUrl} controls className="h-8 max-w-[min(100%,280px)]" preload="metadata" />
      </div>
    );
  }

  if (isVid) {
    return (
      <div className={chipClass}>
        <video
          src={mediaUrl}
          controls
          className={kind === 'video_note' ? 'max-h-48 w-48 rounded-full object-cover' : 'max-h-52 max-w-full rounded-md'}
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={item.fileName || 'attachment'}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium text-inherit hover:opacity-90 dark:border-white/20 dark:bg-black/20"
    >
      <FileText size={14} className="shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </a>
  );
}

function TgBlobMediaAttachment({ dealId, item }: { dealId: string; item: DealCommentAttachment }) {
  const mid = item.tgMessageId;
  const kind = (item.kind || 'file').toLowerCase();
  const mime = (item.mime || '').toLowerCase();
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(false);

  React.useEffect(() => {
    if (mid == null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setErr(false);
    setBlobUrl(null);
    void (async () => {
      try {
        const blob = await api.integrationsTelegramPersonal.fetchDealMediaBlob(dealId, mid);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        if (!cancelled) setErr(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [dealId, mid, kind]);

  if (mid == null) return null;

  const label =
    item.fileName ||
    item.title ||
    (kind === 'voice' ? 'Голосовое' : kind === 'video_note' ? 'Видеосообщение' : kind === 'sticker' ? 'Стикер' : 'Вложение');
  const chipClass =
    'inline-flex max-w-full flex-col gap-1 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium text-inherit dark:border-white/20 dark:bg-black/20';

  if (loading) {
    return (
      <div className={chipClass}>
        <span className="opacity-70">Загрузка…</span>
      </div>
    );
  }
  if (err || !blobUrl) {
    return (
      <div className={chipClass}>
        <span className="text-rose-600/90 dark:text-rose-400/90">Не удалось загрузить</span>
      </div>
    );
  }

  const isImg = kind === 'image' || kind === 'sticker' || mime.startsWith('image/');
  const isAud = kind === 'voice' || kind === 'audio' || mime.startsWith('audio/');
  const isVid = kind === 'video' || kind === 'video_note' || mime.startsWith('video/');

  if (isImg) {
    return (
      <div className={chipClass}>
        <img src={blobUrl} alt="" className="max-h-48 max-w-full rounded-md object-contain" />
        {item.durationSec != null ? (
          <span className="text-[10px] opacity-80">{formatDuration(item.durationSec)}</span>
        ) : null}
      </div>
    );
  }

  if (isAud) {
    return (
      <div className={chipClass}>
        <audio src={blobUrl} controls className="h-8 max-w-[min(100%,280px)]" preload="metadata" />
      </div>
    );
  }

  if (isVid) {
    return (
      <div className={chipClass}>
        <video
          src={blobUrl}
          controls
          className={kind === 'video_note' ? 'max-h-48 w-48 rounded-full object-cover' : 'max-h-52 max-w-full rounded-md'}
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <a
      href={blobUrl}
      download={item.fileName || `telegram-${mid}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium text-inherit hover:opacity-90 dark:border-white/20 dark:bg-black/20"
    >
      <FileText size={14} className="shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </a>
  );
}

export const DealCommentAttachments: React.FC<{
  items?: DealCommentAttachment[];
  /** Нужен для скачивания медиа личного Telegram по tgMessageId */
  dealId?: string;
}> = ({ items, dealId }) => {
  const list = (items || []).filter((a) => {
    if (dealId && a?.storageKey && String(a.storageKey).trim()) return true;
    if (a?.url) {
      if (isBlockedExternalMediaUrl(a.url)) return false;
      return true;
    }
    if (dealId && a?.tgMessageId != null && typeof a.tgMessageId === 'number') return true;
    return false;
  });
  if (!list.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {list.map((a, i) => {
        if (dealId && a.storageKey) {
          return (
            <div key={`sk-${a.storageKey}-${i}`} className="max-w-full">
              <StorageMediaAttachment dealId={dealId} item={a} />
            </div>
          );
        }
        if (a.url) {
          const Icon = iconForType(a.type, a.kind);
          const label = (a.title || a.type || a.kind || 'Вложение').replace(/_/g, ' ');
          const isImg = (a.type || '').toLowerCase().includes('image') || (a.kind || '').toLowerCase() === 'image';
          return (
            <a
              key={`url-${a.url}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/25 bg-black/10 px-2 py-1 text-[11px] font-medium text-inherit hover:opacity-90 dark:border-white/20 dark:bg-black/20"
            >
              {isImg ? (
                <img src={a.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              ) : (
                <Icon size={14} className="shrink-0 opacity-80" />
              )}
              <span className="truncate">{label}</span>
            </a>
          );
        }
        const k = (a.kind || '').toLowerCase();
        return (
          <div key={`tg-${a.tgMessageId}-${i}`} className="max-w-full">
            {dealId && TG_STATIC_KINDS.has(k) ? (
              <TgStaticAttachment item={a} />
            ) : dealId ? (
              <TgBlobMediaAttachment dealId={dealId} item={a} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
