import React, { useEffect, useMemo, useRef, useState } from 'react';

type Edge = 'left' | 'right';

function getEdgeVisibility(el: HTMLDivElement | null) {
  if (!el) return { left: false, right: false };
  const maxScrollLeft = el.scrollWidth - el.clientWidth;
  const left = el.scrollLeft > 0;
  // tolerate sub-pixel / rounding
  const right = el.scrollLeft < maxScrollLeft - 1;
  return { left, right };
}

export const ModuleTabsScroller: React.FC<{
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Rounded clipping for edge gradients (prevents corner artifacts) */
  clipClassName?: string;
  /** Adds subtle edge shadows when scrollable */
  shadows?: boolean;
}> = ({
  children,
  className = '',
  contentClassName = '',
  clipClassName = 'rounded-2xl',
  shadows = true,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ left, right }, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setEdges(getEdgeVisibility(el));
    update();

    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  const edgeClass = useMemo(
    () => ({
      left:
        'absolute left-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-r from-black/10 to-transparent dark:from-white/12',
      right:
        'absolute right-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-black/10 to-transparent dark:from-white/12',
    }),
    []
  );

  return (
    <div className={`relative min-w-0 overflow-hidden ${clipClassName} ${className}`}>
      <div
        ref={ref}
        className={`tabs-scrollbar-hidden overflow-x-auto overflow-y-hidden max-w-full ${contentClassName}`}
      >
        {children}
      </div>

      {shadows && left && <div className={edgeClass.left} aria-hidden />}
      {shadows && right && <div className={edgeClass.right} aria-hidden />}
    </div>
  );
};

