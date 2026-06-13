import React, { useState } from 'react';
import { Dices, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Helper for parsing compound dice notation (e.g. 2d6+3)
const parseAndRollDice = (input: string) => {
  const cleanInput = input.toLowerCase().replace(/\s/g, '');
  const regex = /([+-]?)\s*(\d+)d(\d+)|([+-]\d+)/g;
  let match;
  let total = 0;
  let resultParts = [];
  let valid = false;

  while ((match = regex.exec(cleanInput)) !== null) {
    valid = true;
    const sign = match[1] === '-' ? -1 : 1;
    if (match[2] && match[3]) {
      const count = parseInt(match[2], 10);
      const sides = parseInt(match[3], 10);
      if (count > 100 || sides > 1000) return null; // safety
      let subTotal = 0;
      let rolls = [];
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        subTotal += r;
        rolls.push(r);
      }
      total += sign * subTotal;
      resultParts.push(`${match[1]||''}${count}d${sides}[${rolls.join(',')}]`);
    } else if (match[4]) {
      const val = parseInt(match[4], 10);
      total += val;
      resultParts.push(match[4]);
    }
  }

  if (!valid) return null;
  return { total, detail: resultParts.join(' ') };
};

export function DiceRoller() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<{ id: number; text: string }[]>([]);
  const [formula, setFormula] = useState('');

  const parseAndRoll = (input: string) => {
    const res = parseAndRollDice(input);
    if (res) {
      setHistory(prev => [{ id: Date.now(), text: `${input} ➔ ${res.detail} = ${res.total}` }, ...prev].slice(0, 10));
    } else {
      setHistory(prev => [{ id: Date.now(), text: `Invalid: ${input}` }, ...prev].slice(0, 10));
    }
  };

  const throwDiceText = (d: number) => {
    const res = Math.floor(Math.random() * d) + 1;
    setHistory(prev => [{ id: Date.now(), text: `1d${d} ➔ ${res}` }, ...prev].slice(0, 10));
  };

  return (
    <div className={`dice-roller ${isOpen ? 'open' : ''}`}>
      <div className="dice-toggle" onClick={() => setIsOpen(!isOpen)}>
        <Dices size={24} />
      </div>
      <div className="dice-panel">
        <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent-primary)', display: 'flex', justifyContent: 'space-between' }}>
          <span>주사위 굴리기</span>
          <Trash2 size={16} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setHistory([])} />
        </h4>
        <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', flexWrap: 'wrap' }}>
          {[4, 6, 8, 10, 12, 20, 100].map(d => (
            <button key={d} className="btn" style={{ padding: '5px 10px', flex: '1 1 calc(33% - 5px)' }} onClick={() => throwDiceText(d)}>
              d{d}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); parseAndRoll(formula); setFormula(''); }} style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
          <input type="text" className="input-field" value={formula} onChange={e => setFormula(e.target.value)} placeholder="예: 2d6+3" style={{ flex: 1, padding: '5px 10px' }} />
          <button type="submit" className="btn btn-action" style={{ padding: '5px 10px' }}>굴리기</button>
        </form>
        <div style={{ maxHeight: '150px', overflowY: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          {history.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '0.9em', textAlign: 'center' }}>기록이 없습니다</div> : null}
          {history.map((h, i) => (
            <div key={h.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.9em', opacity: Math.max(0.4, 1 - i * 0.1) }}>
              {h.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
