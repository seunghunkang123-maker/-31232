import React, { useState } from 'react';
import parse, { HTMLReactParserOptions, domToReact } from 'html-react-parser';
import { useFloating, autoUpdate, offset, flip, shift, useHover, useFocus, useDismiss, useRole, useInteractions, useClick, safePolygon } from '@floating-ui/react';
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
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  const hover = useHover(context, { 
    handleClose: safePolygon({
      buffer: 1,
    }),
    delay: { open: 100, close: 100 }
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

  if (!data) return <span>{keywordNode}</span>;

  return (
    <span className="inline-block relative">
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        className="text-amber-400 underline decoration-dashed underline-offset-4 cursor-pointer hover:bg-amber-400/10 rounded px-1 transition-colors font-bold"
      >
        {data.icon && <span className="mr-1">{data.icon}</span>}
        {keywordNode}
      </span>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="z-[9999] max-w-sm bg-black/90 text-white p-4 rounded-lg shadow-2xl border border-gray-600 backdrop-blur-md text-sm leading-relaxed"
          >
            <div className="font-bold text-amber-400 mb-2 flex items-center gap-2 text-base border-b border-gray-600 pb-2">
              {data.icon && <span>{data.icon}</span>}
              {keywordNode}
            </div>
            <div className="tooltip-content" style={{ whiteSpace: 'pre-wrap' }}>
              <ParsedText text={data.description} stats={stats} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
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
      if (domNode.type === 'tag' && domNode.name.toLowerCase() === 'span' && domNode.attribs) {
        const className = domNode.attribs.class || domNode.attribs.className || '';
        const isKeywordMemo = className.split(' ').includes('keyword-memo');
        const hasMemoAttr = 'data-memo' in domNode.attribs;
        
        if (isKeywordMemo) {
          const keywordString = getTextContent(domNode);
          const keywordNode = domToReact(domNode.children, options);
          const customDesc = domNode.attribs['data-memo'];
          // Even if customDesc is empty string, we should treat it as a custom tooltip if the attribute exists
          return <KeywordTooltip keywordNode={keywordNode} keywordString={keywordString} customDesc={customDesc} stats={stats} />;
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
