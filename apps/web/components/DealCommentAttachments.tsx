import React from 'react';
import { Paperclip, Image as ImageIcon, Video, FileText } from 'lucide-react';

export type DealCommentAttachment = { type?: string; url?: string; title?: string };

function iconForType(t?: string) {
  const s = (t || '').toLowerCase();
  if (s.includes('image') || s === 'ig_reel' || s === 'share') return ImageIcon;
  if (s.includes('video')) return Video;
  if (s.includes('audio')) return FileText;
  return Paperclip;
}

export const DealCommentAttachments: React.FC<{ items?: DealCommentAttachment[] }> = ({ items }) => {
  const list = (items || []).filter((a) => a?.url);
  if (!list.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {list.map((a, i) => {
        const Icon = iconForType(a.type);
        const label = (a.title || a.type || 'Вложение').replace(/_/g, ' ');
        const isImg = (a.type || '').toLowerCase().includes('image');
        return (
          <a
            key={`${a.url}-${i}`}
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
      })}
    </div>
  );
};
