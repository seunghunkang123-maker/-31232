import React, { useEffect } from 'react';
import { FloatingPortal } from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParsedText } from './ParsedText';
import { X, Pin, Edit2 } from 'lucide-react';

export type TooltipData = {
  el: HTMLElement;
  content: string;
  stats: any;
  icon?: string;
  type: 'system' | 'user';
  isPinned?: boolean;
};

export function GlobalTooltip({ data, onMouseEnter, onMouseLeave, onClose, onPinToggle, onEdit, isEditable }: { data: TooltipData | null, onMouseEnter?: () => void, onMouseLeave?: () => void, onClose?: () => void, onPinToggle?: () => void, onEdit?: () => void, isEditable?: boolean }) {
  // Handle click outside
  useEffect(() => {
    if (!data || !onClose) return;
    
    const handleOutsideAction = (e: TouchEvent | MouseEvent) => {
      // If pinned, only the X button or an explicit onClose call should close it
      if (data.isPinned) return;

      const target = e.target as Node;
      const tooltipEl = document.getElementById('global-tooltip-panel');
      
      if (
        tooltipEl && 
        !tooltipEl.contains(target) &&
        data.el &&
        !data.el.contains(target) &&
        !(target as HTMLElement).closest('.modal-overlay') // ignore clicks inside modal
      ) {
        onClose();
      }
    };

    document.addEventListener('touchstart', handleOutsideAction);
    document.addEventListener('mousedown', handleOutsideAction);
    
    return () => {
      document.removeEventListener('touchstart', handleOutsideAction);
      document.removeEventListener('mousedown', handleOutsideAction);
    };
  }, [data, onClose]);

  return (
    <AnimatePresence>
      {data && (
        <FloatingPortal>
          <motion.div
            id="global-tooltip-panel"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed z-[10000] sm:right-6 sm:top-24 bottom-6 right-1/2 translate-x-1/2 sm:translate-x-0 w-[90vw] sm:w-[350px] bg-white text-gray-900 p-5 rounded-2xl shadow-2xl border border-gray-200 text-sm leading-relaxed ring-1 ring-black/5"
          >
            <div className="absolute top-3 right-3 flex gap-2">
              {onEdit && data.type !== 'system' && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEditable) onEdit();
                    else alert('✏️ 편집 모드로 먼저 전환해야 툴팁을 수정할 수 있습니다.');
                  }}
                  className={`p-1.5 rounded-full transition-colors ${isEditable ? 'bg-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
                  aria-label="Edit tooltip"
                  title={isEditable ? "툴팁 내용 수정" : "편집 모드에서 수정 가능"}
                >
                  <Edit2 size={14} strokeWidth={3} />
                </button>
              )}
              {onPinToggle && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinToggle();
                  }}
                  className={`p-1.5 rounded-full transition-colors ${data.isPinned ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 hover:text-gray-900 hover:bg-gray-200'}`}
                  aria-label="Pin tooltip"
                  title="화면에 고정하기"
                >
                  <Pin size={14} strokeWidth={3} className={data.isPinned ? "rotate-45" : ""} />
                </button>
              )}
              {onClose && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="p-1.5 rounded-full transition-colors bg-gray-100 text-gray-400 hover:text-gray-900 hover:bg-gray-200"
                  aria-label="Close tooltip"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              )}
            </div>
            <div className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-base border-b border-gray-200 pb-2 flex-wrap pr-24 bg-white shrink-0">
              {data.icon && <span className="text-lg">{data.icon}</span>}
              <span className="tracking-tight">{data.el.textContent?.replace('📌', '').trim()}</span>
            </div>
            <div className="tooltip-content overflow-y-auto max-h-[50vh] sm:max-h-[60vh] custom-scrollbar" style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>
              <ParsedText text={data.content} stats={data.stats} />
            </div>
          </motion.div>
        </FloatingPortal>
      )}
    </AnimatePresence>
  );
}
