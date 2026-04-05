import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Dices, Swords, User, LogOut, Plus, Trash2, Eye, EyeOff, BookOpen, Save, Image as ImageIcon, FileText, Database } from 'lucide-react';

// --- Types ---
type CardType = 'statblock' | 'image' | 'text';

interface Stats { str: number; dex: number; con: number; int: number; wis: number; cha: number; }

interface CardData {
  id: string; session_id: string; type: CardType; title: string; content: string;
  img_src?: string; is_revealed: boolean; stats: Stats;
}

interface SessionData { id: string; name: string; dm_id: string; created_at: string; }

interface PlayerSheet {
  id: string; user_id: string; session_id: string; character_name: string; content: string; stats: Stats;
}

interface Initiative { id: string; name: string; score: number; is_active: boolean; }

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
    stats JSONB DEFAULT '{"str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.player_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    character_name TEXT DEFAULT '새 캐릭터',
    content TEXT,
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

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>로딩 중...</div>;
  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <div className="app-container">
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
        <DMDashboard session={activeSession} user={user} onBack={() => setActiveSession(null)} openModal={setModalImg} />
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
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)' }}
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
function DMDashboard({ session, user, onBack, openModal }: any) {
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
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
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

  return (
    <div className="dashboard">
      <div className="header">
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>현재 세션: <span style={{ color: 'var(--accent-primary)' }}>{session.name}</span> <span style={{fontSize:'0.6em', color:'var(--text-muted)'}}>(마스터)</span></h2>
        <button className="btn" style={{ background: '#4b5563' }} onClick={onBack}>← 세션 목록으로</button>
      </div>

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
  );
}

function DMCard({ card, updateCard, deleteCard, openModal }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${card.session_id}/${card.id}_${Date.now()}.${fileExt}`;
        
        const { error } = await supabase!.storage.from('images').upload(fileName, file);
        if (error) throw error;

        const { data: { publicUrl } } = supabase!.storage.from('images').getPublicUrl(fileName);
        updateCard(card.id, { img_src: publicUrl });
      } catch (error: any) {
        alert('이미지 업로드 실패: ' + error.message);
      } finally {
        setUploading(false);
      }
    }
  };

  const updateStat = (stat: keyof Stats, val: number) => {
    updateCard(card.id, { stats: { ...card.stats, [stat]: val } });
  };

  return (
    <div className={`card ${card.is_revealed ? 'revealed' : ''}`}>
      <div className="card-header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '60%' }} onClick={e => e.stopPropagation()}>
          <span style={{ color: 'var(--accent-primary)' }}>{isExpanded ? '▼' : '▶'}</span>
          <input type="text" className="card-title" value={card.title} onChange={e => updateCard(card.id, { title: e.target.value })} style={{ width: '100%' }} />
        </div>
        <div onClick={e => e.stopPropagation()}>
          <button className={`btn btn-reveal ${card.is_revealed ? 'active' : ''}`} onClick={() => updateCard(card.id, { is_revealed: !card.is_revealed })}>
            {card.is_revealed ? <><Eye size={16} style={{verticalAlign:'middle'}}/> 공개됨</> : <><EyeOff size={16} style={{verticalAlign:'middle'}}/> 숨김</>}
          </button>
          <button className="btn btn-danger" style={{ padding: '8px', marginLeft: '5px' }} onClick={() => deleteCard(card.id)}><Trash2 size={16}/></button>
        </div>
      </div>

      {isExpanded && (
        <div className="card-body">
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
                  <input type="number" className="stat-input" value={card.stats[stat]} onChange={e => updateStat(stat, parseInt(e.target.value) || 0)} />
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
              </div>
              <div 
                ref={editorRef} className="editor" contentEditable suppressContentEditableWarning
                onBlur={e => updateCard(card.id, { content: e.currentTarget.innerHTML })}
                dangerouslySetInnerHTML={{ __html: card.content }}
              />
            </>
          )}
        </div>
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

  const updateSheet = async (updates: Partial<PlayerSheet>) => {
    if (!sheet) return;
    setSheet({ ...sheet, ...updates });
    await supabase!.from('player_sheets').update(updates).eq('id', sheet.id);
  };

  const getModifier = (score: number) => {
    let mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  return (
    <div className="dashboard">
      <div className="header">
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>현재 세션: <span style={{ color: 'var(--accent-primary)' }}>{session.name}</span> <span style={{fontSize:'0.6em', color:'var(--text-muted)'}}>(플레이어)</span></h2>
        <button className="btn" style={{ background: '#4b5563' }} onClick={onBack}>← 세션 목록으로</button>
      </div>

      <InitiativeTracker sessionId={session.id} isDM={false} />

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card-container" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ width: '100%', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>공유된 정보</h3>
          {cards.map((card: CardData) => (
            <div key={card.id} className={`card player-card ${card.is_revealed ? '' : 'blurred'}`}>
              <div className="secret-badge">DM SECRET<br/><span style={{ fontSize: '0.5em', color: 'var(--text-main)' }}>마스터가 비공개 중입니다</span></div>
              <div className="card-header">
                <div className="card-title">{card.is_revealed ? card.title : '??? (미확인 개체)'}</div>
              </div>
              <div className="card-body">
                {card.img_src && <img src={card.img_src} className="image-preview" onClick={() => openModal(card.img_src)} />}
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
                <div className="editor-content" dangerouslySetInnerHTML={{ __html: card.content }} />
              </div>
            </div>
          ))}
        </div>

        {sheet && (
          <div className="card" style={{ flex: '1 1 400px', position: 'sticky', top: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <User color="var(--accent-primary)" />
              <input type="text" value={sheet.character_name} onChange={e => updateSheet({ character_name: e.target.value })} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '1.3em', fontWeight: 'bold', outline: 'none', width: '100%' }} />
              <button className="btn btn-action" style={{ padding: '6px 12px', fontSize: '0.9em', whiteSpace: 'nowrap' }} onClick={() => { setShowLoadModal(true); fetchSavedSheets(); }}><Database size={14} style={{verticalAlign:'middle'}}/> 불러오기</button>
            </div>
            
            <div className="stats-grid" style={{ marginBottom: '20px' }}>
              {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => (
                <div className="stat-box" key={stat}>
                  <span className="stat-name">{stat.toUpperCase()}</span>
                  <input type="number" className="stat-input" value={sheet.stats[stat]} onChange={e => updateSheet({ stats: { ...sheet.stats, [stat]: parseInt(e.target.value) || 0 } })} />
                  <span className="stat-val" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>({getModifier(sheet.stats[stat])})</span>
                </div>
              ))}
            </div>

            <div className="toolbar" style={{ marginBottom: '10px' }}>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('bold')}><b>B</b></button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('italic')}><i>I</i></button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => document.execCommand('underline')}><u>U</u></button>
            </div>
            <div 
              className="editor" contentEditable suppressContentEditableWarning
              onBlur={e => updateSheet({ content: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: sheet.content }}
              style={{ minHeight: '300px' }}
            />
          </div>
        )}
      </div>

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
          <input type="text" placeholder="이름 (캐릭터/몬스터)" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'white' }} />
          <input type="number" placeholder="우선권 수치" value={newScore} onChange={e => setNewScore(e.target.value)} style={{ width: '100px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'white' }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
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
