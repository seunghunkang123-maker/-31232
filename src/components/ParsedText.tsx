import React from 'react';
import parse, { domToReact, HTMLReactParserOptions } from 'html-react-parser';
import { keywordDictionary } from '../lib/keywordDictionary';

export function evaluateExpression(expr: string, stats: any): string | number {
  if (!stats) return expr;
  
  let parsedExpr = expr.replace(/([a-zA-Z가-힣]+)/g, (match) => {
    if (stats[match] !== undefined) {
      return stats[match];
    }
    return match;
  });

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
        parts.push(
          <span 
            key={`kw-${keyCounter++}`} 
            className="keyword-memo text-amber-400 underline decoration-dashed underline-offset-4 cursor-pointer hover:text-amber-300 transition-colors font-bold inline"
            data-memo={encodeURIComponent(desc)}
          >
            <span className="mr-1 inline-block select-none">📌</span>
            {kw}
          </span>
        );
      } else if (keywordDictionary[content]) {
        const dictData = keywordDictionary[content];
        parts.push(
          <span 
            key={`kw-${keyCounter++}`} 
            className="keyword-memo text-amber-400 underline decoration-dashed underline-offset-4 cursor-pointer hover:text-amber-300 transition-colors font-bold inline"
            data-keyword={content}
          >
            {dictData.icon && <span className="mr-1 inline-block select-none">{dictData.icon}</span>}
            {content}
          </span>
        );
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
          const newClassName = `${className} text-amber-400 underline decoration-dashed underline-offset-4 cursor-pointer hover:text-amber-300 transition-colors font-bold inline`.trim();
          
          const props: any = { className: newClassName };
          if (attribs['data-memo']) props['data-memo'] = attribs['data-memo'];
          if (attribs['data-keyword']) props['data-keyword'] = attribs['data-keyword'];
          if (attribs.id) props.id = attribs.id;
          if (attribs.style) props.style = attribs.style;
          
          return (
            <span {...props}>
              {domToReact(domNode.children, options)}
            </span>
          );
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
