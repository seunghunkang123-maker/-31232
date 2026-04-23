import React, { useEffect } from 'react';
import { useFloating, autoUpdate, offset, flip, shift, FloatingPortal } from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParsedText } from './ParsedText';
import { X } from 'lucide-react';

export type TooltipData = {
  el: HTMLElement;
  content: string;
  stats: any;
  icon?: string;
  type: 'system' | 'user';
};

export function GlobalTooltip({ data, onMouseEnter, onMouseLeave, onClose }: { data: TooltipData | null, onMouseEnter?: () => void, onMouseLeave?: () => void, onClose?: () => void }) {
  const { refs, x, y, strategy } = useFloating({
    elements: { reference: data?.el },
    open: !!data,
    placement: 'right',
    whileElementsMounted: autoUpdate,
    middleware: [offset(12), flip(), shift({ padding: 8 })],
  });

  // Handle click outside to close on mobile
  useEffect(() => {
    if (!data || !onClose) return;
    
    const handleTouchOutside = (e: TouchEvent | MouseEvent) => {
      const target = e.target as Node;
      // If click is outside the tooltip and outside the reference element
      if (
        refs.floating.current && 
        !refs.floating.current.contains(target) &&
        data.el &&
        !data.el.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener('touchstart', handleTouchOutside);
    document.addEventListener('mousedown', handleTouchOutside);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchOutside);
      document.removeEventListener('mousedown', handleTouchOutside);
    };
  }, [data, onClose, refs]);

  return (
    <AnimatePresence>
      {data && (
        <FloatingPortal>
          <motion.div
            ref={refs.setFloating}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
              zIndex: 10000,
            }}
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="w-[90vw] sm:w-auto max-w-sm bg-gray-900/95 text-white p-5 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 backdrop-blur-2xl text-sm leading-relaxed ring-1 ring-white/5"
          >
            {onClose && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="absolute top-3 right-3 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 p-1.5 rounded-full transition-colors"
                aria-label="Close tooltip"
              >
                <X size={14} strokeWidth={3} />
              </button>
            )}
            <div className="font-bold text-amber-400 mb-3 flex items-center gap-2 text-base border-b border-white/10 pb-2 flex-wrap pr-6">
              {data.icon && <span className="text-lg">{data.icon}</span>}
              <span className="tracking-tight">{data.el.textContent?.replace('📌', '').trim()}</span>
            </div>
            <div className="tooltip-content overflow-y-auto max-h-[300px] custom-scrollbar" style={{ whiteSpace: 'pre-wrap', color: '#d1d5db' }}>
              <ParsedText text={data.content} stats={data.stats} />
            </div>
          </motion.div>
        </FloatingPortal>
      )}
    </AnimatePresence>
  );
}
