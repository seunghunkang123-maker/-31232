import React, { useState } from 'react';
import parse, { HTMLReactParserOptions, domToReact } from 'html-react-parser';
import { useFloating, autoUpdate, offset, flip, shift, useHover, useFocus, useDismiss, useRole, useInteractions, useClick, safePolygon, FloatingPortal } from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { keywordDictionary } from '../lib/keywordDictionary';

function evaluateExpression(expr: string, stats: Record<string, any> = {}) {
  let parsedExpr = expr;
  const statMap: Record<string, string> = {
    '근력': 'str', 'STR': 'str', 'str': 'str',
    '민첩': 'dex', 'DEX': 'dex', 'dex': 'dex',
    '건강': 'con', 'CON': 'con', 'con': 'con',
    '지능': 'int', 'INT': 'int', 'int': 'int',
    '지혜': 'wis', 'WIS': 'wis', 'wis': 'wis',
    '매력': 'cha', 'CHA': 'cha', 'cha': 'cha',
    '공격력': 'str'
  };
  
  let hasStat = false;
  Object.keys(statMap).forEach(key => {
    if (parsedExpr.includes(key)) {
      hasStat = true;
      const statVal = Number(stats[statMap[key]]) || 0;
      parsedExpr = parsedExpr.replace(new RegExp(key, 'g'), statVal.toString());
    }
  });

  if (!hasStat) return expr;

  try {
    if (/^[0-9\.\+\-\*\/\(\)\s]+$/.test(parsedExpr)) {
      const result = new Function('return ' + parsedExpr)();
      return Number.isInteger(result) ? result : Number(result).toFixed(1);
    }
    return expr;
  } catch (e) {
    return expr;
  }
}

export const KeywordTooltip: React.FC<{ keywordNode: React.ReactNode, keywordString: string, stats: any, customDesc?: string }> = ({ keywordNode, keywordString, stats, customDesc }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [offset(12), flip(), shift({ padding: 8 })],
  });

  const hover = useHover(context, { 
    handleClose: safePolygon({
      buffer: 1,
    }),
    delay: { open: 150, close: 150 }
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    click,
    dismiss,
    role,
  ]);

  const data = customDesc !== undefined ? { description: customDesc, icon: '📌' } : keywordDictionary[keywordString];

  if (!data) return <span className="inline">{keywordNode}</span>;

  return (
    <>
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        className="text-amber-400 underline decoration-dashed underline-offset-4 cursor-pointer hover:text-amber-300 transition-colors font-bold inline"
      >
        {data.icon && <span className="mr-1 inline-block select-none">{data.icon}</span>}
        {keywordNode}
      </span>
      <AnimatePresence>
        {isOpen && (
          <FloatingPortal>
            <motion.div
              ref={refs.setFloating}
              style={{
                ...floatingStyles,
                zIndex: 10000,
              }}
              {...getFloatingProps()}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-sm bg-gray-900/95 text-white p-5 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 backdrop-blur-2xl text-sm leading-relaxed ring-1 ring-white/5"
            >
              <div className="font-bold text-amber-400 mb-3 flex items-center gap-2 text-base border-b border-white/10 pb-2 flex-wrap">
                {data.icon && <span className="text-lg">{data.icon}</span>}
                <span className="tracking-tight">{keywordNode}</span>
              </div>
              <div className="tooltip-content overflow-y-auto max-h-[300px] custom-scrollbar" style={{ whiteSpace: 'pre-wrap', color: '#d1d5db' }}>
                <ParsedText text={data.description} stats={stats} />
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                <span>{customDesc !== undefined ? "User Memo" : "System Entry"}</span>
                <span className="opacity-50">TRPG Assistant</span>
              </div>
            </motion.div>
          </FloatingPortal>
        )}
      </AnimatePresence>
    </>
  );
}

const getTextContent = (node: any): string => {
  if (node.type === 'text') return node.data;
  if (node.children) return node.children.map(getTextContent).join('');
  return '';
};

export function ParsedText({ text, stats }: { text: string, stats: any }) {
  const replaceText = (str: string) => {
    const regex = /\[([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let keyCounter = 0;
    
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      const content = match[1];
      
      if (content.includes('|')) {
        const [kw, ...descParts] = content.split('|');
        const desc = descParts.join('|');
        parts.push(<KeywordTooltip key={`kw-${keyCounter++}`} keywordNode={kw} keywordString={kw} customDesc={desc} stats={stats} />);
      } else if (keywordDictionary[content]) {
        parts.push(<KeywordTooltip key={`kw-${keyCounter++}`} keywordNode={content} keywordString={content} stats={stats} />);
      } else {
        const evaluated = evaluateExpression(content, stats);
        if (evaluated !== content) {
          parts.push(<span key={`stat-${keyCounter++}`} className="text-emerald-400 font-bold bg-emerald-400/10 px-1 rounded">{evaluated}</span>);
        } else {
          parts.push(`[${content}]`);
        }
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts;
  };

  const options: HTMLReactParserOptions = {
    replace: (domNode: any) => {
      if (domNode.type === 'tag' && domNode.attribs) {
        const attribs = domNode.attribs;
        const className = attribs.class || attribs.className || '';
        const isKeywordMemo = className.split(/\s+/).includes('keyword-memo');
        const hasMemoAttr = 'data-memo' in attribs;
        
        if (isKeywordMemo || hasMemoAttr) {
          const keywordString = getTextContent(domNode);
          const keywordNode = domToReact(domNode.children, options);
          // data-memo 속성을 더 확실하게 가져오기 (소문자, 카멜케이스 모두 대응)
          let customDesc = attribs['data-memo'] || attribs['datamemo'] || attribs['dataMemo'];
          
          // data-memo가 명시적으로 존재한다면 (빈 문자열 포함) 커스텀 툴팁으로 처리
          const isCustom = 'data-memo' in attribs || 'datamemo' in attribs || 'dataMemo' in attribs;
          
          if (isCustom) {
            try {
              if (customDesc) customDesc = decodeURIComponent(customDesc);
            } catch (e) {
              // Ignore if not encoded
            }
            return (
              <KeywordTooltip 
                key={domNode.attribs.id || Math.random().toString()}
                keywordNode={keywordNode} 
                keywordString={keywordString} 
                customDesc={customDesc || ''} 
                stats={stats} 
              />
            );
          }
        }
      }
      if (domNode.type === 'text' && domNode.data) {
        const parsed = replaceText(domNode.data);
        if (parsed.length > 1 || parsed[0] !== domNode.data) {
          return <>{parsed}</>;
        }
      }
    }
  };

  return <>{parse(text, options)}</>;
}
