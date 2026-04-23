import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Dices, Swords, User, LogOut, Plus, Trash2, Eye, EyeOff, BookOpen, Save, Image as ImageIcon, FileText, Database, Timer, Play, Pause, RotateCcw, X, Minus } from 'lucide-react';
import { ParsedText } from './components/ParsedText';
import { GlobalTooltip, TooltipData } from './components/GlobalTooltip';
import { keywordDictionary } from './lib/keywordDictionary';

// --- Types ---
type CardType = 'statblock' | 'image' | 'text';

interface Stats { str: number | string; dex: number | string; con: number | string; int: number | string; wis: number | string; cha: number | string; }

type RevealMode = 'hidden' | 'name_only' | 'image_only' | 'full';

interface CardData {
  id: string; session_id: string; type: CardType; title: string; content: string;
  img_src?: string; is_revealed: boolean; reveal_mode?: RevealMode; stats: Stats;
  hp?: number; max_hp?: number; temp_hp?: number;
}

interface TimerData {
  id: string;
  label: string;
  duration: number; // remaining seconds
  end_timestamp: number | null; // Date.now() + remaining
  is_running: boolean;
}

interface SessionData { 
  id: string; name: string; dm_id: string; created_at: string; 
  background_url?: string; timers?: TimerData[];
}

interface PlayerSheet {
  id: string; user_id: string; session_id: string; character_name: string; content: string; stats: Stats;
  hp?: number; max_hp?: number; temp_hp?: number;
}

interface Initiative { id: string; name: string; score: number; is_active: boolean; }

// --- Helper Components ---
function HPBar({ current, max, temp = 0, isDM, onUpdate, hideNumbers }: { current: number, max: number, temp?: number, isDM: boolean, onUpdate?: (updates: any) => void, hideNumbers?: boolean }) {
  const percent = Math.min(100, Math.max(0, (current / max) * 100));
  const tempPercent = Math.min(100, (temp / max) * 100);
  
  let color = 'var(--accent-success)';
  if (percent < 25) color = 'var(--accent-danger)';
  else if (percent < 50) color = '#f59e0b'; // orange

  const adjust = (val: number) => {
    if (!onUpdate) return;
    if (val > 0) {
      onUpdate({ hp: Math.min(max, current + val) });
    } else {
      let damage = Math.abs(val);
      let newTemp = temp;
      let newHp = current;
      
      if (newTemp > 0) {
        const absorb = Math.min(newTemp, damage);
        newTemp -= absorb;
        damage -= absorb;
      }
      
      if (damage > 0) {
        newHp = Math.max(0, newHp - damage);
      }
      
      onUpdate({ hp: newHp, temp_hp: newTemp });
    }
  };

  return (
    <div className="hp-container">
      <div className="hp-text" style={{ justifyContent: hideNumbers && !isDM ? 'center' : 'space-between' }}>
        {(!hideNumbers || isDM) ? (
          <>
            <span>HP {current}{temp > 0 ? ` (+${temp})` : ''} / {max}</span>
            <span>{Math.round(percent)}%</span>
          </>
        ) : (
          <span>HP 여력</span>
        )}
      </div>
      <div className="hp-bar-bg" style={{ opacity: current <= 0 ? 0.3 : 1 }}>
        <div className="hp-bar-fill" style={{ width: `${percent}%`, backgroundColor: color }} />
        {temp > 0 && <div className="hp-bar-temp" style={{ width: `${tempPercent}%`, left: `${percent}%` }} />}
      </div>
      {isDM && (
        <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
          <button className="btn" style={{ padding: '4px 8px', background: 'var(--accent-danger)' }} onClick={() => adjust(-1)}>-1</button>
          <button className="btn" style={{ padding: '4px 8px', background: 'var(--accent-danger)' }} onClick={() => adjust(-5)}>-5</button>
          <button className="btn" style={{ padding: '4px 8px', background: 'var(--accent-success)' }} onClick={() => adjust(1)}>+1</button>
          <button className="btn" style={{ padding: '4px 8px', background: 'var(--accent-success)' }} onClick={() => adjust(5)}>+5</button>
          <div style={{ flex: 1 }} />
          <input 
            type="number" 
            placeholder="Max" 
            value={max} 
            onChange={e => onUpdate?.({ max_hp: parseInt(e.target.value) || 1 })} 
            style={{ width: '50px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', textAlign: 'center', fontSize: '0.8em' }}
          />
        </div>
      )}
    </div>
  );
}

// --- Main Entry ---
export default function App() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupScreen />;
  }
  return <MainApp />;
}

// --- Setup Screen ---
function SupabaseSetupScreen() {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1><Database size={32} /> Supabase 연동 준비 완료</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          앱을 정상적으로 실행하려면 Supabase 프로젝트 설정이 필요합니다. 다음 단계를 완료해주세요.
        </p>
        <ol style={{ lineHeight: '1.8', marginBottom: '20px' }}>
          <li>Supabase 프로젝트를 생성합니다.</li>
          <li><code>.env</code> 파일에 <code>VITE_SUPABASE_URL</code>과 <code>VITE_SUPABASE_ANON_KEY</code>를 입력합니다. (AI Studio Secrets 패널 이용)</li>
          <li>Supabase 대시보드의 <b>Storage</b> 메뉴에서 <code>images</code>라는 이름의 버킷(Bucket)을 생성하고, <b>Public bucket</b>으로 설정합니다.</li>
          <li>Supabase 대시보드의 SQL Editor에서 아래 스키마를 실행하여 테이블을 생성합니다.</li>
        </ol>
        <pre>
{`-- D&D 5e Session Hub Supabase Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    dm_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    img_src TEXT,
    is_revealed BOOLEAN DEFAULT FALSE,
    reveal_mode TEXT DEFAULT 'hidden',
    hp INTEGER DEFAULT 10,
    max_hp INTEGER DEFAULT 10,
    temp_hp INTEGER DEFAULT 0,
    stats JSONB DEFAULT '{"str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.player_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    character_name TEXT DEFAULT '새 캐릭터',
    content TEXT,
    hp INTEGER DEFAULT 10,
    max_hp INTEGER DEFAULT 10,
    temp_hp INTEGER DEFAULT 0,
    stats JSONB DEFAULT '{"str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10}'::jsonb,
    UNIQUE(user_id, session_id)
);

CREATE TABLE public.initiatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS background_url TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS timers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS reveal_mode TEXT DEFAULT 'hidden';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS hp INTEGER DEFAULT 10;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS max_hp INTEGER DEFAULT 10;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS temp_hp INTEGER DEFAULT 0;
ALTER TABLE public.player_sheets ADD COLUMN IF NOT EXISTS hp INTEGER DEFAULT 10;
ALTER TABLE public.player_sheets ADD COLUMN IF NOT EXISTS max_hp INTEGER DEFAULT 10;
ALTER TABLE public.player_sheets ADD COLUMN IF NOT EXISTS temp_hp INTEGER DEFAULT 0;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiatives DISABLE ROW LEVEL SECURITY;

-- 실시간 동기화를 위한 설정 (필수)
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.initiatives;
alter publication supabase_realtime add table public.player_sheets;
alter publication supabase_realtime add table public.sessions;

-- Storage 버킷 생성 (images)
insert into storage.buckets (id, name, public) values ('images', 'images', true) on conflict do nothing;
create policy "public_read" on storage.objects for select using ( bucket_id = 'images' );
create policy "public_insert" on storage.objects for insert with check ( bucket_id = 'images' );
`}
        </pre>
      </div>
    </div>
  );
}

// --- Main App Logic ---
function MainApp() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [modalImg, setModalImg] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('dnd_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase!.channel('active_session_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${activeSession.id}` }, (payload) => {
        setActiveSession(payload.new as SessionData);
      })
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [activeSession?.id]);

  // Timer Countdown Logic
  useEffect(() => {
    if (!activeSession?.timers || activeSession.timers.length === 0) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const nextTimers = activeSession.timers!.map(t => {
        if (!t.is_running || !t.end_timestamp) return t;
        const remaining = Math.max(0, Math.round((t.end_timestamp - now) / 1000));
        if (remaining !== t.duration) {
          changed = true;
          return { ...t, duration: remaining, is_running: remaining > 0 };
        }
        return t;
      });

      if (changed) {
        setActiveSession({ ...activeSession, timers: nextTimers });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.timers]);

  if (loading) return <div style={{ color: 'var(--text-main)', textAlign: 'center', marginTop: '50px' }}>로딩 중...</div>;
  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <div className="app-container" style={{
      backgroundImage: activeSession?.background_url ? `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url(${activeSession.background_url})` : 'none',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
      minHeight: '100vh', transition: 'background-image 0.5s ease-in-out'
    }}>
      <div className="session-bar" style={{ maxWidth: '1200px', margin: '20px auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Swords color="var(--accent-primary)" /> D&D 5e 세션 허브
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9em', marginRight: '10px' }}>
            {user.username} ({user.role === 'dm' ? '마스터' : '플레이어'})
          </span>
          <button className="btn" style={{ background: '#4b5563' }} onClick={() => { 
            setActiveSession(null); 
            localStorage.removeItem('dnd_user');
            setUser(null); 
          }}><LogOut size={16} style={{ display: 'inline', verticalAlign: 'middle' }}/></button>
        </div>
      </div>

      {!activeSession ? (
        <SessionLobby user={user} onSelect={setActiveSession} />
      ) : activeSession.dm_id === user.id ? (
        <DMDashboard session={activeSession} user={user} onBack={() => setActiveSession(null)} openModal={setModalImg} setActiveSession={setActiveSession} />
      ) : (
        <PlayerDashboard session={activeSession} user={user} onBack={() => setActiveSession(null)} openModal={setModalImg} />
      )}

      <DiceRoller />

      {modalImg && (
        <div id="image-modal" className="show" onClick={() => setModalImg(null)}>
          <img id="modal-img" src={modalImg} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// --- Auth Screen ---
function AuthScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signupRole, setSignupRole] = useState<'player' | 'dm'>('player');
  const [dmCode, setDmCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!username || !password) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    
    try {
      if (isLogin) {
        const { data, error } = await supabase!.from('users').select('*').eq('username', username).eq('password', password).maybeSingle();
        if (error || !data) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
        
        localStorage.setItem('dnd_user', JSON.stringify(data));
        onLogin(data);
      } else {
        if (signupRole === 'dm' && dmCode !== '1234') {
          alert('마스터 생성 암호가 틀렸습니다.');
          setLoading(false);
          return;
        }
        
        const { data: existing } = await supabase!.from('users').select('id').eq('username', username).maybeSingle();
        if (existing) throw new Error('이미 존재하는 아이디입니다.');

        const { error } = await supabase!.from('users').insert([{ username, password, role: signupRole }]);
        if (error) throw error;
        
        alert('회원가입 성공! 로그인해주세요.');
        setIsLogin(true);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 style={{ color: 'var(--accent-primary)', marginBottom: '10px' }}><Swords size={32} style={{ verticalAlign: 'middle' }}/> D&D 5e Hub</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>모험을 시작하려면 계정이 필요합니다.</p>
        
        <div className="auth-tabs">
          <div className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>로그인</div>
          <div className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>회원가입</div>
        </div>

        {!isLogin && (
          <div style={{ marginBottom: '15px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <label style={{ color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input type="radio" name="role" checked={signupRole === 'player'} onChange={() => setSignupRole('player')} /> 플레이어
            </label>
            <label style={{ color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input type="radio" name="role" checked={signupRole === 'dm'} onChange={() => setSignupRole('dm')} /> 마스터(DM)
            </label>
          </div>
        )}

        <input type="text" placeholder="아이디" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
        
        {!isLogin && signupRole === 'dm' && (
          <input type="password" placeholder="마스터 생성 암호" value={dmCode} onChange={e => setDmCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
        )}

        <button onClick={handleAuth} disabled={loading}>
          {loading ? '처리 중...' : isLogin ? '입장하기' : '계정 생성'}
        </button>
      </div>
    </div>
  );
}

// --- Session Lobby ---
function SessionLobby({ user, onSelect }: any) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [newName, setNewName] = useState('');
  const isDM = user?.role === 'dm';

  const fetchSessions = async () => {
    const { data } = await supabase!.from('sessions').select('*').order('created_at', { ascending: false });
    if (data) setSessions(data);
  };

  useEffect(() => { 
    fetchSessions(); 
    const channel = supabase!.channel('sessions_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchSessions)
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, []);

  const handleCreate = async () => {
    if (!newName) return;
    const { data, error } = await supabase!.from('sessions').insert([{ name: newName, dm_id: user.id }]).select();
    if (!error && data) {
      setNewName('');
      fetchSessions();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까? 관련 데이터가 모두 지워집니다.')) {
      await supabase!.from('sessions').delete().eq('id', id);
      fetchSessions();
    }
  };

  return (
    <div className="dashboard">
      <div className="header">
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>세션 선택</h2>
      </div>
      
      {isDM && (
        <div className="card" style={{ marginBottom: '30px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="새 세션 이름 (예: 2026-04-04 첫 모험)" 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button className="btn btn-add" onClick={handleCreate}><Plus size={16} style={{ verticalAlign: 'middle' }}/> 새 세션 생성</button>
        </div>
      )}

      <div className="card-container">
        {sessions.map(s => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
            <div>
              <h3 style={{ margin: 0, cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '1.2em' }} onClick={() => onSelect(s)}>{s.name}</h3>
              <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{s.dm_id === user.id ? '👑 내가 마스터인 세션' : '👤 플레이어로 참여'}</span>
            </div>
            <div>
              <button className="btn btn-action" onClick={() => onSelect(s)}>입장</button>
              {s.dm_id === user.id && <button className="btn btn-danger" style={{ marginLeft: '10px' }} onClick={() => handleDelete(s.id)}><Trash2 size={16}/></button>}
            </div>
          </div>
        ))}
        {sessions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>생성된 세션이 없습니다.</p>}
      </div>
    </div>
  );
}

// --- DM Dashboard ---
function DMDashboard({ session, user, onBack, openModal, setActiveSession }: any) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedMonsters, setSavedMonsters] = useState<any[]>([]);

  const fetchCards = async () => {
    const { data } = await supabase!.from('cards').select('*').eq('session_id', session.id).order('created_at', { ascending: false });
    if (data) setCards(data);
  };

  const fetchSavedMonsters = async () => {
    const { data: sessions } = await supabase!.from('sessions').select('id, name').eq('dm_id', user.id);
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s: any) => s.id);
      const { data: cards } = await supabase!.from('cards')
        .select('*')
        .in('session_id', sessionIds)
        .eq('type', 'statblock');
      
      const cardsWithSession = cards?.map((c: any) => ({
        ...c,
        session_name: sessions.find((s: any) => s.id === c.session_id)?.name
      }));
      setSavedMonsters(cardsWithSession || []);
    }
  };

  useEffect(() => {
    fetchCards();
    const channel = supabase!.channel('cards_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `session_id=eq.${session.id}` }, fetchCards)
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [session.id]);

  const addCard = async (type: CardType) => {
    const newCard = {
      session_id: session.id, type,
      title: type === 'statblock' ? '새 몬스터' : type === 'image' ? '새 이미지' : '새 텍스트',
      content: type === 'statblock' ? '<b>방어도</b> 10<br><b>HP</b> 10 (2d8)<br><b>이동 속도</b> 30ft<hr><b>행동</b><br>공격: +2 명중, 1d6 피해.' : '',
      is_revealed: false,
      reveal_mode: 'hidden',
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10, max_hp: 10
    };
    await supabase!.from('cards').insert([newCard]);
    fetchCards();
  };

  const updateCard = async (id: string, updates: Partial<CardData>) => {
    await supabase!.from('cards').update(updates).eq('id', id);
    fetchCards();
  };

  const deleteCard = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await supabase!.from('cards').delete().eq('id', id);
      fetchCards();
    }
  };

  const updateSession = async (updates: Partial<SessionData>) => {
    setActiveSession({ ...session, ...updates });
    await supabase!.from('sessions').update(updates).eq('id', session.id);
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `bg_${session.id}_${Date.now()}.${fileExt}`;
        const { error } = await supabase!.storage.from('images').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase!.storage.from('images').getPublicUrl(fileName);
        updateSession({ background_url: publicUrl });
      } catch (error: any) {
        alert('배경 업로드 실패: ' + error.message);
      }
    }
  };

  const handleBgRemove = async () => {
    updateSession({ background_url: null });
  };

  const addTimer = () => {
    const newTimer: TimerData = {
      id: 'timer-' + Date.now(),
      label: '새 타이머',
      duration: 60,
      end_timestamp: null,
      is_running: false
    };
    updateSession({ timers: [...(session.timers || []), newTimer] });
  };

  const updateTimer = (timerId: string, updates: Partial<TimerData>) => {
    const nextTimers = (session.timers || []).map(t => {
      if (t.id !== timerId) return t;
      const updated = { ...t, ...updates };
      if (updates.is_running === true) {
        updated.end_timestamp = Date.now() + updated.duration * 1000;
      } else if (updates.is_running === false) {
        updated.end_timestamp = null;
      }
      return updated;
    });
    updateSession({ timers: nextTimers });
  };

  const deleteTimer = (timerId: string) => {
    updateSession({ timers: (session.timers || []).filter(t => t.id !== timerId) });
  };

  return (
    <div className="main-layout">
      <div className="dashboard" style={{ flex: 1, minWidth: 0, padding: '20px 0', margin: 0 }}>
        <div className="header">
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>현재 세션: <span style={{ color: 'var(--accent-primary)' }}>{session.name}</span> <span style={{fontSize:'0.6em', color:'var(--text-muted)'}}>(마스터)</span></h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-action" onClick={addTimer}><Timer size={16} style={{verticalAlign:'middle'}}/> 타이머 추가</button>
          <input type="file" id="bg-upload" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />
          <label htmlFor="bg-upload" className="btn btn-action" style={{ cursor: 'pointer', padding: '8px 16px', margin: 0 }}><ImageIcon size={16} style={{verticalAlign:'middle'}}/> 배경 설정</label>
          {session.background_url && <button className="btn btn-danger" onClick={handleBgRemove}>배경 제거</button>}
          <button className="btn" style={{ background: '#4b5563' }} onClick={onBack}>← 세션 목록으로</button>
        </div>
      </div>

      <TimerManager timers={session.timers || []} isDM={true} onUpdate={updateTimer} onDelete={deleteTimer} />
      <InitiativeTracker sessionId={session.id} isDM={true} />

      <div className="toolbar" style={{ marginBottom: '20px', justifyContent: 'center', background: 'transparent', border: 'none' }}>
        <button className="btn btn-action" onClick={() => { setShowLoadModal(true); fetchSavedMonsters(); }}><Database size={16} style={{verticalAlign:'middle'}}/> 몬스터 불러오기</button>
        <button className="btn btn-add" onClick={() => addCard('statblock')}><User size={16} style={{verticalAlign:'middle'}}/> 몬스터/NPC 추가</button>
        <button className="btn btn-add" onClick={() => addCard('image')}><ImageIcon size={16} style={{verticalAlign:'middle'}}/> 지도/이미지 추가</button>
        <button className="btn btn-add" onClick={() => addCard('text')}><FileText size={16} style={{verticalAlign:'middle'}}/> 텍스트 노트 추가</button>
      </div>

      <div className="card-container">
        {cards.map((card: CardData) => (
          <DMCard key={card.id} card={card} updateCard={updateCard} deleteCard={deleteCard} openModal={openModal} />
        ))}
        {cards.length === 0 && <p style={{ textAlign: 'center', width: '100%', color: 'var(--text-muted)' }}>추가된 카드가 없습니다.</p>}
      </div>

      {showLoadModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowLoadModal(false)}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-primary)' }}>저장된 몬스터 불러오기</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>다른 세션에서 만들었던 몬스터를 복사해옵니다.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              {savedMonsters.map(m => (
                <div key={m.id} className="init-item" style={{ cursor: 'pointer' }} onClick={() => {
                  const newCard = {
                    session_id: session.id, type: 'statblock',
                    title: m.title, content: m.content, img_src: m.img_src,
                    is_revealed: false, stats: m.stats
                  };
                  supabase!.from('cards').insert([newCard]).then(() => fetchCards());
                  setShowLoadModal(false);
                }}>
                  <div>
                    <strong>{m.title}</strong>
                    <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>from {m.session_name}</div>
                  </div>
                  <Plus size={16} />
                </div>
              ))}
              {savedMonsters.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>저장된 몬스터가 없습니다.</p>}
            </div>
            <button className="btn" style={{ width: '100%', marginTop: '20px', background: '#4b5563' }} onClick={() => setShowLoadModal(false)}>닫기</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function DMCard({ card, updateCard, deleteCard, openModal }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingMemo, setEditingMemo] = useState<{ id: string, html: string } | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTooltipTimeout = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  const handleEditorMouseOver = (e: React.MouseEvent) => {
    clearTooltipTimeout();
    setTooltipData((prev: TooltipData | null) => {
      if (prev?.isPinned) return prev;
      
      const target = e.target as HTMLElement;
      const trigger = target.closest('.keyword-memo') as HTMLElement;
      if (!trigger) return null;

      let content = trigger.getAttribute('data-memo') || '';
      let isEncoded = trigger.hasAttribute('data-memo');
      let icon = undefined;
      let type: 'system' | 'user' = 'user';

      if (!content) {
        const keyword = trigger.getAttribute('data-keyword') || trigger.textContent || '';
        const dictData = keywordDictionary[keyword];
        if (dictData) {
          content = dictData.description;
          icon = dictData.icon;
          type = 'system';
          isEncoded = false;
        }
      }

      if (content) {
        if (isEncoded) {
          try { content = decodeURIComponent(content); } catch(err) {}
        }
        return { el: trigger, content, stats: localStats, icon, type };
      }
      return null;
    });
  };

  const handleEditorMouseOut = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.keyword-memo')) {
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltipData(prev => (prev?.isPinned ? prev : null));
      }, 300);
    }
  };
  const editorRef = useRef<HTMLDivElement>(null);

  // 한글 입력(IME) 끊김 방지 및 DOM 동기화 문제를 위한 로컬 상태
  const [localTitle, setLocalTitle] = useState(card.title);
  const [localStats, setLocalStats] = useState(card.stats);
  const [localContent, setLocalContent] = useState(card.content);

  useEffect(() => { setLocalTitle(card.title); }, [card.title]);
  useEffect(() => { setLocalStats(card.stats); }, [card.stats]);
  useEffect(() => { 
    // 에디터가 포커스 중이 아닐 때만 외부 변경사항 반영
    if (document.activeElement !== editorRef.current) {
      setLocalContent(card.content); 
    }
  }, [card.content]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${card.session_id}/${card.id}_${Date.now()}.${fileExt}`;
        
        const { error } = await supabase!.storage.from('images').upload(fileName, file);
        if (error) {
          if (error.message.includes('Bucket not found')) {
            throw new Error("Supabase Storage에 'images' 버킷이 없습니다. 첫 화면의 SQL을 다시 실행하거나 대시보드에서 생성해주세요.");
          }
          throw error;
        }

        const { data: { publicUrl } } = supabase!.storage.from('images').getPublicUrl(fileName);
        updateCard(card.id, { img_src: publicUrl });
      } catch (error: any) {
        alert('이미지 업로드 실패: ' + error.message);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleStatChange = (stat: keyof Stats, val: string | number) => {
    setLocalStats({ ...localStats, [stat]: val });
  };

  const handleStatBlur = () => {
    updateCard(card.id, { stats: localStats });
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const trigger = target.closest('.keyword-memo') as HTMLElement;
    
    if (isPreviewMode) {
      if (trigger) {
        setTooltipData(prev => {
          if (prev && prev.el === trigger) return { ...prev, isPinned: !prev.isPinned };
          if (prev && prev.isPinned) return null;
          return prev;
        });
      }
      return;
    }

    if (trigger) {
      let currentMemo = trigger.getAttribute('data-memo') || '';
      try { currentMemo = decodeURIComponent(currentMemo); } catch (e) {}
      if (!trigger.id) trigger.id = 'memo-' + Date.now();
      setEditingMemo({ id: trigger.id, html: currentMemo });
    }
  };

  const saveMemo = (html: string) => {
    if (!editingMemo) return;
    const span = document.getElementById(editingMemo.id);
    if (span) {
      if (html.trim() === '' || html === '<br>') {
        const textNode = document.createTextNode(span.textContent || '');
        span.parentNode?.replaceChild(textNode, span);
      } else {
        span.dataset.memo = encodeURIComponent(html);
        span.removeAttribute('title');
        span.removeAttribute('id');
      }
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setLocalContent(newContent);
        updateCard(card.id, { content: newContent });
      }
    }
    setEditingMemo(null);
  };

  const deleteMemo = () => {
    if (!editingMemo) return;
    const span = document.getElementById(editingMemo.id);
    if (span) {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
      if (editorRef.current) updateCard(card.id, { content: editorRef.current.innerHTML });
    }
    setEditingMemo(null);
  };

  const cancelMemo = () => {
    if (!editingMemo) return;
    const span = document.getElementById(editingMemo.id);
    if (span) {
      if (!span.getAttribute('data-memo')) {
        const textNode = document.createTextNode(span.textContent || '');
        span.parentNode?.replaceChild(textNode, span);
        if (editorRef.current) updateCard(card.id, { content: editorRef.current.innerHTML });
      } else {
        span.removeAttribute('id');
      }
    }
    setEditingMemo(null);
  };

  return (
    <div className={`card ${card.reveal_mode !== 'hidden' ? 'revealed' : ''}`} style={{ opacity: (card.hp !== undefined && card.hp <= 0) ? 0.6 : 1 }}>
      <div className="card-header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }} onClick={e => e.stopPropagation()}>
          <span style={{ color: 'var(--accent-primary)', fontSize: '1.2em', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', cursor: 'pointer' }} onClick={() => setIsExpanded(!isExpanded)}>▶</span>
          <input type="text" className="card-title" value={localTitle} onChange={e => setLocalTitle(e.target.value)} onBlur={() => { if (localTitle !== card.title) updateCard(card.id, { title: localTitle }) }} style={{ width: '100%', maxWidth: '300px' }} />
        </div>
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className={`btn`} 
            style={{ 
              padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', 
              background: card.reveal_mode === 'hidden' ? 'var(--bg-main)' : 'var(--accent-success)',
              color: card.reveal_mode === 'hidden' ? 'var(--text-main)' : '#fff',
              border: card.reveal_mode === 'hidden' ? '1px solid var(--border-color)' : '1px solid var(--accent-success)'
            }}
            onClick={() => updateCard(card.id, { reveal_mode: card.reveal_mode === 'hidden' ? 'full' : 'hidden' })}
          >
            {card.reveal_mode === 'hidden' ? <><EyeOff size={14}/> 비공개</> : <><Eye size={14}/> 플레이어에게 공개됨</>}
          </button>
          <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => deleteCard(card.id)} title="카드 삭제"><Trash2 size={16}/></button>
        </div>
      </div>

      {isExpanded && (
        <div className="card-body">
          <div style={{ background: 'var(--stat-bg)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)', fontSize: '0.9em' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Eye size={16} /> 플레이어 화면 표시 설정
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: 'var(--text-muted)', width: '80px' }}>공개 범위:</span>
                <select 
                  value={card.reveal_mode} 
                  onChange={e => updateCard(card.id, { reveal_mode: e.target.value as any })}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.95em' }}
                >
                  <option value="hidden">완전 비공개</option>
                  <option value="name_only">이름만 공개 (상세정보/이미지 숨기기)</option>
                  <option value="image_only">이미지만 공개 (상세정보 숨기기)</option>
                  <option value="full">전체 공개 (스탯, 내용 포함)</option>
                </select>
              </div>

              {card.reveal_mode !== 'hidden' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ color: 'var(--text-muted)', width: '80px' }}>이름 표시:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="radio" checked={!card.stats?.hide_name} onChange={() => updateCard(card.id, { stats: { ...card.stats, hide_name: false }})} /> 진짜 이름
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="radio" checked={card.stats?.hide_name} onChange={() => updateCard(card.id, { stats: { ...card.stats, hide_name: true }})} /> 가명 사용
                  </label>
                  {card.stats?.hide_name && (
                    <input type="text" value={card.stats?.alt_name || ''} onChange={e => updateCard(card.id, { stats: {...card.stats, alt_name: e.target.value }})} placeholder="??? (미확인 개체)" style={{ padding: '2px 8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', width: '140px' }} />
                  )}
                </div>
              )}

              {card.reveal_mode === 'full' && card.hp !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ color: 'var(--text-muted)', width: '80px' }}>HP 표시:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="radio" checked={!card.stats?.hide_hp && !card.stats?.hide_hp_text} onChange={() => updateCard(card.id, { stats: { ...card.stats, hide_hp: false, hide_hp_text: false }})} /> 수치+바(Bar)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="radio" checked={!card.stats?.hide_hp && card.stats?.hide_hp_text} onChange={() => updateCard(card.id, { stats: { ...card.stats, hide_hp: false, hide_hp_text: true }})} /> 바(Bar)만
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input type="radio" checked={card.stats?.hide_hp} onChange={() => updateCard(card.id, { stats: { ...card.stats, hide_hp: true, hide_hp_text: false }})} /> 숨김
                  </label>
                </div>
              )}
            </div>
          </div>

          <HPBar current={card.hp ?? 10} max={card.max_hp ?? 10} temp={card.temp_hp ?? 0} isDM={true} onUpdate={(u) => updateCard(card.id, u)} />
          
          {(card.type === 'image' || card.type === 'statblock') && (
            <div style={{ marginBottom: '15px' }}>
              <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>이미지 첨부:</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ marginLeft: '10px', color: 'var(--text-main)' }} />
              {uploading && <span style={{ fontSize: '0.8em', color: 'var(--accent-primary)', marginLeft: '10px' }}>업로드 중...</span>}
              {card.img_src && <img src={card.img_src} className="image-preview" onClick={() => openModal(card.img_src)} />}
            </div>
          )}

          {card.type === 'statblock' && (
            <div className="stats-grid">
              {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => (
                <div className="stat-box" key={stat}>
                  <span className="stat-name">{stat.toUpperCase()}</span>
                  <input type="text" className="stat-input" value={localStats[stat]} onChange={e => handleStatChange(stat, e.target.value)} onBlur={handleStatBlur} />
                </div>
              ))}
            </div>
          )}

          {(card.type === 'statblock' || card.type === 'text') && (
            <>
              <div className="toolbar">
                <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('bold')}><b>B</b></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('italic')}><i>I</i></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('underline')}><u>U</u></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#ef4444')} style={{ color: 'var(--accent-danger)' }}>Red</button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#3b82f6')} style={{ color: 'var(--accent-primary)' }}>Blue</button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#000000')} style={{ color: '#000000', fontWeight: 'bold' }}>Black</button>
                <button onMouseDown={e => {
                  e.preventDefault();
                  const selection = window.getSelection();
                  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                    alert('툴팁을 추가할 단어를 드래그해서 선택해주세요.');
                    return;
                  }
                  const tempId = 'memo-' + Date.now();
                  const html = `<span id="${tempId}" class="keyword-memo" data-memo="">${selection.toString()}</span>`;
                  document.execCommand('insertHTML', false, html);
                  
                  if (editorRef.current) {
                    const newContent = editorRef.current.innerHTML;
                    setLocalContent(newContent);
                    updateCard(card.id, { content: newContent });
                    
                    const inserted = document.getElementById(tempId);
                    if (inserted) {
                      setEditingMemo({ id: tempId, html: '' });
                    }
                  }
                }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}>📝 툴팁 추가</button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => setIsPreviewMode(!isPreviewMode)} style={{ marginLeft: 'auto', background: isPreviewMode ? 'var(--accent-primary)' : 'var(--bg-main)', color: isPreviewMode ? '#fff' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                  {isPreviewMode ? '✏️ 편집 모드' : '👁️ 미리보기 (키워드 확인)'}
                </button>
              </div>
              {isPreviewMode ? (
                <div 
                  className="editor-content" 
                  style={{ minHeight: '150px' }}
                  onMouseOver={handleEditorMouseOver}
                  onMouseOut={handleEditorMouseOut}
                >
                  <ParsedText text={card.content} stats={localStats} />
                </div>
              ) : (
                <div 
                  ref={editorRef} className="editor" contentEditable suppressContentEditableWarning
                  onBlur={e => {
                    const newContent = e.currentTarget.innerHTML;
                    setLocalContent(newContent);
                    updateCard(card.id, { content: newContent });
                  }}
                  onClick={handleEditorClick}
                  onMouseOver={handleEditorMouseOver}
                  onMouseOut={handleEditorMouseOut}
                  dangerouslySetInnerHTML={{ __html: localContent }}
                />
              )}
            </>
          )}
        </div>
      )}
      <GlobalTooltip 
        data={tooltipData} 
        onMouseEnter={clearTooltipTimeout}
        onMouseLeave={() => {
          tooltipTimeoutRef.current = setTimeout(() => {
            setTooltipData(null);
          }, 300);
        }}
        onClose={() => setTooltipData(null)}
      />
      {editingMemo && (
        <TooltipEditorModal
          initialHtml={editingMemo.html}
          onSave={saveMemo}
          onCancel={cancelMemo}
          onDelete={deleteMemo}
        />
      )}
    </div>
  );
}

// --- Player Dashboard ---
function PlayerDashboard({ session, user, onBack, openModal }: any) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [sheet, setSheet] = useState<PlayerSheet | null>(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedSheets, setSavedSheets] = useState<any[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingMemo, setEditingMemo] = useState<{ id: string, html: string } | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTooltipTimeout = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  const handleEditorMouseOver = (e: React.MouseEvent) => {
    clearTooltipTimeout();
    setTooltipData((prev: TooltipData | null) => {
      if (prev?.isPinned) return prev;
      
      const target = e.target as HTMLElement;
      const trigger = target.closest('.keyword-memo') as HTMLElement;
      if (!trigger) return null;

      let content = trigger.getAttribute('data-memo') || '';
      let isEncoded = trigger.hasAttribute('data-memo');
      let icon = undefined;
      let type: 'system' | 'user' = 'user';

      if (!content) {
        const keyword = trigger.getAttribute('data-keyword') || trigger.textContent || '';
        const dictData = keywordDictionary[keyword];
        if (dictData) {
          content = dictData.description;
          icon = dictData.icon;
          type = 'system';
          isEncoded = false;
        }
      }

      if (content) {
        if (isEncoded) {
          try { content = decodeURIComponent(content); } catch(err) {}
        }
        return { el: trigger, content, stats: localStats, icon, type };
      }
      return null;
    });
  };

  const handleEditorMouseOut = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.keyword-memo')) {
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltipData(prev => (prev?.isPinned ? prev : null));
      }, 300);
    }
  };

  // 한글 입력(IME) 끊김 방지 및 DOM 동기화 문제를 위한 로컬 상태
  const [localCharName, setLocalCharName] = useState('');
  const [localStats, setLocalStats] = useState<Stats | null>(null);
  const [localContent, setLocalContent] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  const fetchCards = async () => {
    const { data } = await supabase!.from('cards').select('*').eq('session_id', session.id).order('created_at', { ascending: false });
    if (data) setCards(data);
  };

  const fetchSheet = async () => {
    let { data } = await supabase!.from('player_sheets').select('*').eq('session_id', session.id).eq('user_id', user.id).single();
    if (!data) {
      const newSheet = { session_id: session.id, user_id: user.id, character_name: '새 캐릭터', content: '', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
      const res = await supabase!.from('player_sheets').insert([newSheet]).select().single();
      data = res.data;
    }
    setSheet(data);
  };

  const fetchSavedSheets = async () => {
    const { data } = await supabase!.from('player_sheets')
      .select('*, sessions(name)')
      .eq('user_id', user.id)
      .neq('session_id', session.id);
    if (data) setSavedSheets(data);
  };

  useEffect(() => {
    fetchCards();
    fetchSheet();
    const channel = supabase!.channel('player_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `session_id=eq.${session.id}` }, fetchCards)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_sheets', filter: `session_id=eq.${session.id}` }, fetchSheet)
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [session.id]);

  useEffect(() => {
    if (sheet) {
      setLocalCharName(sheet.character_name);
      setLocalStats(sheet.stats);
      // 에디터가 포커스 중이 아닐 때만 외부 변경사항 반영
      if (document.activeElement !== editorRef.current) {
        setLocalContent(sheet.content);
      }
    }
  }, [sheet]);

  const updateSheet = async (updates: Partial<PlayerSheet>) => {
    if (!sheet) return;
    setSheet({ ...sheet, ...updates });
    await supabase!.from('player_sheets').update(updates).eq('id', sheet.id);
  };

  const getModifier = (score: number | string) => {
    const num = parseInt(score as string, 10);
    if (isNaN(num)) return score;
    let mod = Math.floor((num - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const trigger = target.closest('.keyword-memo') as HTMLElement;
    
    if (isPreviewMode) {
      if (trigger) {
        setTooltipData(prev => {
          if (prev && prev.el === trigger) return { ...prev, isPinned: !prev.isPinned };
          if (prev && prev.isPinned) return null;
          return prev;
        });
      }
      return;
    }

    if (trigger) {
      let currentMemo = trigger.getAttribute('data-memo') || '';
      try { currentMemo = decodeURIComponent(currentMemo); } catch (e) {}
      if (!trigger.id) trigger.id = 'memo-' + Date.now();
      setEditingMemo({ id: trigger.id, html: currentMemo });
    }
  };

  const saveMemo = (html: string) => {
    if (!editingMemo) return;
    const span = document.getElementById(editingMemo.id);
    if (span) {
      if (html.trim() === '' || html === '<br>') {
        const textNode = document.createTextNode(span.textContent || '');
        span.parentNode?.replaceChild(textNode, span);
      } else {
        span.dataset.memo = encodeURIComponent(html);
        span.removeAttribute('title');
        span.removeAttribute('id');
      }
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setLocalContent(newContent);
        updateSheet({ content: newContent });
      }
    }
    setEditingMemo(null);
  };

  const deleteMemo = () => {
    if (!editingMemo) return;
    const span = document.getElementById(editingMemo.id);
    if (span) {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setLocalContent(newContent);
        updateSheet({ content: newContent });
      }
    }
    setEditingMemo(null);
  };

  const cancelMemo = () => {
    if (!editingMemo) return;
    const span = document.getElementById(editingMemo.id);
    if (span) {
      if (!span.getAttribute('data-memo')) {
        const textNode = document.createTextNode(span.textContent || '');
        span.parentNode?.replaceChild(textNode, span);
        if (editorRef.current) {
          const newContent = editorRef.current.innerHTML;
          setLocalContent(newContent);
          updateSheet({ content: newContent });
        }
      } else {
        span.removeAttribute('id');
      }
    }
    setEditingMemo(null);
  };

  return (
    <div className="main-layout">
      <div className="dashboard" style={{ flex: 1, minWidth: 0, padding: '20px 0', margin: 0 }}>
        <div className="header">
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>현재 세션: <span style={{ color: 'var(--accent-primary)' }}>{session.name}</span> <span style={{fontSize:'0.6em', color:'var(--text-muted)'}}>(플레이어)</span></h2>
        <button className="btn" style={{ background: '#4b5563' }} onClick={onBack}>← 세션 목록으로</button>
      </div>

      <TimerManager timers={session.timers || []} isDM={false} />
      <InitiativeTracker sessionId={session.id} isDM={false} />

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card-container" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ width: '100%', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>공유된 정보</h3>
          {cards.map((card: CardData) => {
            const mode = card.reveal_mode || (card.is_revealed ? 'full' : 'hidden');
            if (mode === 'hidden') return null;

            return (
              <div key={card.id} className={`card player-card ${mode === 'full' ? '' : 'revealed'}`} style={{ opacity: (card.hp !== undefined && card.hp <= 0) ? 0.6 : 1 }}>
                <div className="card-header">
                  <div className="card-title">{(mode === 'image_only' || card.stats?.hide_name) ? (card.stats?.alt_name || '??? (미확인 개체)') : card.title}</div>
                </div>
                <div className="card-body">
                  {(mode === 'full' || mode === 'image_only') && card.img_src && (
                    <img src={card.img_src} className="image-preview" onClick={() => openModal(card.img_src)} />
                  )}
                  
                  {mode === 'full' && (
                    <>
                      {!card.stats?.hide_hp && <HPBar current={card.hp ?? 10} max={card.max_hp ?? 10} temp={card.temp_hp ?? 0} isDM={false} hideNumbers={!!card.stats?.hide_hp_text} />}
                      {card.type === 'statblock' && (
                        <div className="stats-grid">
                          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => (
                            <div className="stat-box" key={stat}>
                              <span className="stat-name">{stat.toUpperCase()}</span>
                              <span className="stat-val">{card.stats[stat]} ({getModifier(card.stats[stat])})</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div 
                        className="editor-content"
                        onMouseOver={handleEditorMouseOver}
                        onMouseOut={handleEditorMouseOut}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const trigger = target.closest('.keyword-memo') as HTMLElement;
                          if (trigger) {
                            setTooltipData(prev => {
                              if (prev && prev.el === trigger) return { ...prev, isPinned: !prev.isPinned };
                              if (prev && prev.isPinned) return null;
                              return prev;
                            });
                          }
                        }}
                      >
                        <ParsedText text={card.content} stats={card.stats} />
                      </div>
                    </>
                  )}
                  {mode === 'name_only' && <p style={{color:'var(--text-muted)', textAlign:'center', padding:'20px'}}>상세 정보가 아직 공개되지 않았습니다.</p>}
                </div>
              </div>
            );
          })}
        </div>

        {sheet && localStats && (
          <div className="card" style={{ flex: '1 1 400px', position: 'sticky', top: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <User color="var(--accent-primary)" />
              <input type="text" value={localCharName} onChange={e => setLocalCharName(e.target.value)} onBlur={() => { if (localCharName !== sheet.character_name) updateSheet({ character_name: localCharName }) }} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '1.3em', fontWeight: 'bold', outline: 'none', width: '100%' }} />
              <button className="btn btn-action" style={{ padding: '6px 12px', fontSize: '0.9em', whiteSpace: 'nowrap' }} onClick={() => { setShowLoadModal(true); fetchSavedSheets(); }}><Database size={14} style={{verticalAlign:'middle'}}/> 불러오기</button>
            </div>

            <HPBar current={sheet.hp ?? 10} max={sheet.max_hp ?? 10} temp={sheet.temp_hp ?? 0} isDM={true} onUpdate={(u) => updateSheet(u)} />
            
            <div className="stats-grid" style={{ marginBottom: '20px' }}>
              {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => (
                <div className="stat-box" key={stat}>
                  <span className="stat-name">{stat.toUpperCase()}</span>
                  <input type="text" className="stat-input" value={localStats[stat]} onChange={e => setLocalStats({ ...localStats, [stat]: e.target.value })} onBlur={() => updateSheet({ stats: localStats })} />
                  <span className="stat-val" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>({getModifier(localStats[stat])})</span>
                </div>
              ))}
            </div>

            <div className="toolbar" style={{ marginBottom: '10px' }}>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('bold')}><b>B</b></button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('italic')}><i>I</i></button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('underline')}><u>U</u></button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#ef4444')} style={{ color: 'var(--accent-danger)' }}>Red</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#3b82f6')} style={{ color: 'var(--accent-primary)' }}>Blue</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#000000')} style={{ color: '#000000', fontWeight: 'bold' }}>Black</button>
              <button onMouseDown={e => {
                e.preventDefault();
                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                  alert('툴팁을 추가할 단어를 드래그해서 선택해주세요.');
                  return;
                }
                const tempId = 'memo-' + Date.now();
                const html = `<span id="${tempId}" class="keyword-memo" data-memo="">${selection.toString()}</span>`;
                document.execCommand('insertHTML', false, html);
                
                if (editorRef.current) {
                  const newContent = editorRef.current.innerHTML;
                  setLocalContent(newContent);
                  updateSheet({ content: newContent });
                  
                  const inserted = document.getElementById(tempId);
                  if (inserted) {
                    setEditingMemo({ id: tempId, html: '' });
                  }
                }
              }} style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}>📝 툴팁 추가</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => setIsPreviewMode(!isPreviewMode)} style={{ marginLeft: 'auto', background: isPreviewMode ? 'var(--accent-primary)' : 'var(--bg-main)', color: isPreviewMode ? '#fff' : 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                {isPreviewMode ? '✏️ 편집 모드' : '👁️ 미리보기 (키워드 확인)'}
              </button>
            </div>
            {isPreviewMode ? (
              <div 
                className="editor-content" 
                style={{ minHeight: '300px' }}
                onMouseOver={handleEditorMouseOver}
                onMouseOut={handleEditorMouseOut}
              >
                <ParsedText text={sheet.content} stats={localStats} />
              </div>
            ) : (
              <div 
                ref={editorRef}
                className="editor" contentEditable suppressContentEditableWarning
                onBlur={e => {
                  const newContent = e.currentTarget.innerHTML;
                  setLocalContent(newContent);
                  updateSheet({ content: newContent });
                }}
                onClick={handleEditorClick}
                onMouseOver={handleEditorMouseOver}
                onMouseOut={handleEditorMouseOut}
                dangerouslySetInnerHTML={{ __html: localContent }}
                style={{ minHeight: '300px' }}
              />
            )}
          </div>
        )}
      </div>

      <GlobalTooltip 
        data={tooltipData} 
        onMouseEnter={clearTooltipTimeout}
        onMouseLeave={() => {
          tooltipTimeoutRef.current = setTimeout(() => {
            setTooltipData(prev => (prev?.isPinned ? prev : null));
          }, 300);
        }}
        onClose={() => setTooltipData(null)}
        onPinToggle={() => setTooltipData(prev => prev ? { ...prev, isPinned: !prev.isPinned } : null)}
      />

      {showLoadModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowLoadModal(false)}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-primary)' }}>내 캐릭터 불러오기</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>다른 세션에서 사용했던 캐릭터 정보를 덮어씌웁니다.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              {savedSheets.map(s => (
                <div key={s.id} className="init-item" style={{ cursor: 'pointer' }} onClick={() => {
                  if (confirm(`'${s.character_name}' 캐릭터 정보를 현재 시트에 덮어씌우시겠습니까?`)) {
                    updateSheet({ character_name: s.character_name, content: s.content, stats: s.stats });
                    setShowLoadModal(false);
                  }
                }}>
                  <div>
                    <strong>{s.character_name}</strong>
                    <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>from {s.sessions?.name || '알 수 없는 세션'}</div>
                  </div>
                  <Plus size={16} />
                </div>
              ))}
              {savedSheets.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>다른 세션에 저장된 캐릭터가 없습니다.</p>}
            </div>
            <button className="btn" style={{ width: '100%', marginTop: '20px', background: '#4b5563' }} onClick={() => setShowLoadModal(false)}>닫기</button>
          </div>
        </div>
      )}
      {editingMemo && (
        <TooltipEditorModal
          initialHtml={editingMemo.html}
          onSave={saveMemo}
          onCancel={cancelMemo}
          onDelete={deleteMemo}
        />
      )}
      </div>
    </div>
  );
}

// --- Initiative Tracker ---
function InitiativeTracker({ sessionId, isDM }: { sessionId: string, isDM: boolean }) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [newName, setNewName] = useState('');
  const [newScore, setNewScore] = useState('');

  const fetchInit = async () => {
    const { data } = await supabase!.from('initiatives').select('*').eq('session_id', sessionId).order('score', { ascending: false });
    if (data) setInitiatives(data);
  };

  useEffect(() => {
    fetchInit();
    const channel = supabase!.channel('init_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'initiatives', filter: `session_id=eq.${sessionId}` }, fetchInit)
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [sessionId]);

  const handleAdd = async () => {
    if (!newName || !newScore) return;
    await supabase!.from('initiatives').insert([{ session_id: sessionId, name: newName, score: parseInt(newScore) }]);
    setNewName(''); setNewScore('');
    fetchInit();
  };

  const handleDelete = async (id: string) => {
    await supabase!.from('initiatives').delete().eq('id', id);
    fetchInit();
  };

  const handleStartCombat = async () => {
    if (initiatives.length === 0) return;
    await supabase!.from('initiatives').update({ is_active: false }).eq('session_id', sessionId);
    await supabase!.from('initiatives').update({ is_active: true }).eq('id', initiatives[0].id);
    fetchInit();
  };

  const handleNextTurn = async () => {
    if (initiatives.length === 0) return;
    const activeIdx = initiatives.findIndex(i => i.is_active);
    const nextIdx = activeIdx === -1 || activeIdx === initiatives.length - 1 ? 0 : activeIdx + 1;
    
    // Reset all, then set next
    await supabase!.from('initiatives').update({ is_active: false }).eq('session_id', sessionId);
    await supabase!.from('initiatives').update({ is_active: true }).eq('id', initiatives[nextIdx].id);
    fetchInit();
  };

  const handleClear = async () => {
    if (confirm('전투를 종료하고 모든 우선권을 삭제하시겠습니까?')) {
      await supabase!.from('initiatives').delete().eq('session_id', sessionId);
      fetchInit();
    }
  };

  const hasActive = initiatives.some(i => i.is_active);

  if (!isDM && !hasActive) {
    return null;
  }

  return (
    <div className="initiative-tracker">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Swords size={20}/> 전투 우선권 (Initiative) {hasActive && <span style={{fontSize: '0.6em', color: 'var(--accent-danger)'}}>⚔️ 전투 진행 중</span>}
        </h3>
        {isDM && (
          <div>
            {!hasActive ? (
              <button className="btn btn-action" onClick={handleStartCombat} style={{ marginRight: '10px', background: 'var(--accent-danger)' }}>전투 개시!</button>
            ) : (
              <button className="btn btn-action" onClick={handleNextTurn} style={{ marginRight: '10px' }}>다음 턴 ⏭️</button>
            )}
            <button className="btn btn-danger" onClick={handleClear}>전투 종료</button>
          </div>
        )}
      </div>

      {isDM && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <input type="text" placeholder="이름 (캐릭터/몬스터)" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
          <input type="number" placeholder="우선권 수치" value={newScore} onChange={e => setNewScore(e.target.value)} style={{ width: '100px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="btn btn-add" onClick={handleAdd}>추가</button>
        </div>
      )}

      <div className="init-list">
        {initiatives.map(init => (
          <div key={init.id} className={`init-item ${init.is_active ? 'active' : ''}`}>
            <div className="init-score">{init.score}</div>
            <div className="init-name">{init.name} {init.is_active && <span style={{ fontSize: '0.8em', color: 'var(--accent-success)', marginLeft: '10px' }}>◀ 현재 턴</span>}</div>
            {isDM && <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(init.id)}><Trash2 size={14}/></button>}
          </div>
        ))}
        {initiatives.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9em', textAlign: 'center', marginTop: '10px' }}>현재 진행 중인 전투가 없습니다.</p>}
      </div>
    </div>
  );
}

// --- Dice Roller ---
function DiceRoller() {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<string>('주사위를 굴리세요');

  const roll = (sides: number) => {
    const val = Math.floor(Math.random() * sides) + 1;
    setResult(`d${sides} 🎲 ${val}`);
  };

  return (
    <>
      <button className="dice-roller-btn" onClick={() => setIsOpen(!isOpen)}><Dices size={28} /></button>
      {isOpen && (
        <div className="dice-panel">
          <div className="dice-header">
            주사위 굴리기 <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setIsOpen(false)}>X</button>
          </div>
          <div className="dice-body">
            {[4, 6, 8, 10, 12, 20, 100].map(d => (
              <button key={d} className="dice-btn" onClick={() => roll(d)}>d{d}</button>
            ))}
          </div>
          <div className="dice-result-area">{result}</div>
        </div>
      )}
    </>
  );
}

function TooltipEditorModal({ initialHtml, onSave, onCancel, onDelete }: { initialHtml: string, onSave: (html: string) => void, onCancel: () => void, onDelete: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onCancel}>
      <div className="card" style={{ width: '90%', maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: 'var(--accent-primary)' }}>툴팁 내용 편집</h3>
          <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>Shift+Enter: 줄바꿈 / Enter: 단락구분</span>
        </div>
        <div className="toolbar" style={{ marginBottom: '10px', gap: '5px' }}>
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('bold')} title="굵게"><b>B</b></button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('italic')} title="기울임"><i>I</i></button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('underline')} title="밑줄"><u>U</u></button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 5px' }} />
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('fontSize', false, '3')} title="보통">T</button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('fontSize', false, '5')} title="크게"><span style={{fontSize: '1.2em'}}>T</span></button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 5px' }} />
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#ef4444')} style={{ color: '#ef4444' }} title="빨강">●</button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#3b82f6')} style={{ color: '#3b82f6' }} title="파랑">●</button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#10b981')} style={{ color: '#10b981' }} title="초록">●</button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#f59e0b')} style={{ color: '#f59e0b' }} title="노랑">●</button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('foreColor', false, '#000000')} style={{ color: '#000000', fontWeight: 'bold' }} title="검은색">○</button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 5px' }} />
          <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('insertUnorderedList')} title="글머리 기호">List</button>
        </div>
        <div 
          ref={editorRef}
          className="editor" 
          contentEditable 
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialHtml }}
          style={{ minHeight: '200px', marginBottom: '15px', overflowY: 'auto', maxHeight: '400px' }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              // Standard Enter can sometimes create <div> or <p>, Shift+Enter usually <br>
              // We'll let the browser handle it but ensure it's consistent
            }
          }}
        />
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn btn-danger" onClick={onDelete}>툴팁 삭제</button>
          <button className="btn" style={{ background: '#4b5563' }} onClick={onCancel}>취소</button>
          <button className="btn btn-add" onClick={() => onSave(editorRef.current?.innerHTML || '')}>저장</button>
        </div>
      </div>
    </div>
  );
}

// --- Timer Manager ---
function TimerManager({ timers, isDM, onUpdate, onDelete }: { timers: TimerData[], isDM: boolean, onUpdate?: (id: string, u: any) => void, onDelete?: (id: string) => void }) {
  if (timers.length === 0 && !isDM) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timer-panel">
      <h3 style={{ margin: '0 0 15px 0', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1em' }}>
        <Timer size={18}/> 세션 타이머
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
        {timers.map(t => (
          <div key={t.id} className="timer-item">
            <div className={`timer-time ${t.duration === 0 ? 'timer-expired' : ''}`}>
              {formatTime(t.duration)}
            </div>
            <div className="timer-label">
              {isDM ? (
                <input 
                  type="text" 
                  value={t.label} 
                  onChange={e => onUpdate?.(t.id, { label: e.target.value })} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontWeight: 'bold', width: '100%', outline: 'none' }}
                />
              ) : (
                t.label
              )}
            </div>
            {isDM && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {t.is_running ? (
                  <button className="reveal-btn" onClick={() => onUpdate?.(t.id, { is_running: false })}><Pause size={14}/></button>
                ) : (
                  <button className="reveal-btn" onClick={() => onUpdate?.(t.id, { is_running: true })} disabled={t.duration === 0}><Play size={14}/></button>
                )}
                <button className="reveal-btn" onClick={() => {
                  const duration = prompt('시간 설정 (초):', t.duration.toString());
                  if (duration) onUpdate?.(t.id, { duration: parseInt(duration), is_running: false });
                }}><RotateCcw size={14}/></button>
                <button className="reveal-btn" style={{ color: 'var(--accent-danger)' }} onClick={() => onDelete?.(t.id)}><X size={14}/></button>
              </div>
            )}
          </div>
        ))}
        {timers.length === 0 && isDM && <p style={{ color: 'var(--text-muted)', fontSize: '0.9em', margin: 0 }}>타이머가 없습니다. 상단 버튼으로 추가하세요.</p>}
      </div>
    </div>
  );
}
