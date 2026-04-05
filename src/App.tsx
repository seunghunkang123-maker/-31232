import React, { useState, useEffect, useRef } from 'react';

// --- Types ---
type CardType = 'statblock' | 'image' | 'text';

interface Stats {
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
}

interface CardData {
  id: string;
  type: CardType;
  title: string;
  content: string;
  imgSrc?: string;
  isRevealed: boolean;
  stats: Stats;
}

// --- Main App Component ---
export default function App() {
  const [role, setRole] = useState<'dm' | 'player' | null>(null);
  const [password, setPassword] = useState('');
  const [cards, setCards] = useState<CardData[]>([]);
  const [playerSheet, setPlayerSheet] = useState<string>('');
  const [playerStats, setPlayerStats] = useState<Stats>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const [gimmicks, setGimmicks] = useState<string>('여기에 세션의 특별한 기믹이나 현재 걸려있는 상태이상을 기록하세요.');
  const [modalImg, setModalImg] = useState<string | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedCards = localStorage.getItem('dnd_cards_adv');
    if (savedCards) setCards(JSON.parse(savedCards));
    
    const savedSheet = localStorage.getItem('dnd_player_sheet_adv');
    if (savedSheet) setPlayerSheet(savedSheet);

    const savedStats = localStorage.getItem('dnd_player_stats_adv');
    if (savedStats) setPlayerStats(JSON.parse(savedStats));

    const savedGimmicks = localStorage.getItem('dnd_gimmicks_adv');
    if (savedGimmicks) setGimmicks(savedGimmicks);

    // Listen for storage changes to sync across tabs/windows
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dnd_cards_adv' && e.newValue) setCards(JSON.parse(e.newValue));
      if (e.key === 'dnd_gimmicks_adv' && e.newValue) setGimmicks(e.newValue);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Save cards to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dnd_cards_adv', JSON.stringify(cards));
  }, [cards]);

  // Save gimmicks to localStorage
  useEffect(() => {
    localStorage.setItem('dnd_gimmicks_adv', gimmicks);
  }, [gimmicks]);

  const handleLogin = (selectedRole: 'dm' | 'player') => {
    if (selectedRole === 'dm' && password === '1234') {
      setRole('dm');
    } else if (selectedRole === 'player') {
      setRole('player');
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  // --- DM Functions ---
  const addCard = (type: CardType) => {
    const newCard: CardData = {
      id: Date.now().toString(),
      type,
      title: type === 'statblock' ? '새 몬스터' : type === 'image' ? '새 이미지' : '새 텍스트',
      content: type === 'statblock' ? '<b>방어도</b> 10<br><b>HP</b> 10 (2d8)<br><b>이동 속도</b> 30ft<hr><b>행동</b><br>공격: +2 명중, 1d6 피해.' : '',
      isRevealed: false,
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    };
    setCards([newCard, ...cards]);
  };

  const updateCard = (id: string, updates: Partial<CardData>) => {
    setCards(cards.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCard = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setCards(cards.filter(c => c.id !== id));
    }
  };

  const updateStat = (id: string, stat: keyof Stats, val: number) => {
    setCards(cards.map(c => {
      if (c.id === id) {
        return { ...c, stats: { ...c.stats, [stat]: val } };
      }
      return c;
    }));
  };

  // --- Render ---
  if (!role) {
    return <LoginScreen onLogin={handleLogin} password={password} setPassword={setPassword} />;
  }

  return (
    <div className="app-container">
      <div className="session-bar" style={{ maxWidth: '1200px', margin: '20px auto', display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>D&D 5e 세션 허브 ({role === 'dm' ? '마스터' : '플레이어'})</h2>
        <button className="btn" style={{ background: '#4b5563' }} onClick={() => setRole(null)}>로그아웃</button>
      </div>

      {role === 'dm' ? (
        <DMDashboard 
          cards={cards} 
          addCard={addCard} 
          updateCard={updateCard} 
          updateStat={updateStat} 
          deleteCard={deleteCard} 
          gimmicks={gimmicks}
          setGimmicks={setGimmicks}
          openModal={setModalImg}
        />
      ) : (
        <PlayerDashboard 
          cards={cards} 
          playerSheet={playerSheet} 
          setPlayerSheet={setPlayerSheet} 
          playerStats={playerStats}
          setPlayerStats={setPlayerStats}
          gimmicks={gimmicks}
          openModal={setModalImg}
        />
      )}

      {/* Image Modal */}
      {modalImg && (
        <div id="image-modal" className="show" onClick={() => setModalImg(null)}>
          <img id="modal-img" src={modalImg} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// --- Components ---

function LoginScreen({ onLogin, password, setPassword }: any) {
  return (
    <div id="login-screen">
      <div className="login-box">
        <h1 style={{ color: 'var(--accent-primary)', marginBottom: '10px' }}>D&D 5e Session Hub</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '0.95em' }}>모험을 시작하려면 로그인하세요.</p>
        
        <input 
          type="password" 
          placeholder="마스터 비밀번호 (Player는 생략)" 
          value={password} 
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onLogin(password === '1234' ? 'dm' : 'player')}
        />
        
        <button onClick={() => onLogin('dm')}>마스터(DM) 입장</button>
        <button className="btn-secondary" onClick={() => onLogin('player')}>플레이어 입장</button>
      </div>
    </div>
  );
}

function DMDashboard({ cards, addCard, updateCard, updateStat, deleteCard, gimmicks, setGimmicks, openModal }: any) {
  const formatText = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value || undefined);
  };

  return (
    <div className="dashboard">
      {/* Gimmicks & Conditions Panel */}
      <div className="gimmick-panel">
        <h2>⚠️ 세션 기믹 및 상태이상 (마스터 전용 편집)</h2>
        <p style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginBottom: '10px' }}>이곳에 작성된 내용은 플레이어 화면 상단에 실시간으로 공유됩니다.</p>
        <div className="toolbar">
          <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('bold')}><b>B</b></button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('italic')}><i>I</i></button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('underline')}><u>U</u></button>
          <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 5px' }}></span>
          <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('foreColor', '#ef4444')} style={{ color: 'var(--accent-danger)', fontWeight: 'bold' }}>Red</button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('foreColor', '#3b82f6')} style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Blue</button>
          <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('foreColor', '#10b981')} style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>Green</button>
        </div>
        <div 
          className="editor" 
          contentEditable 
          suppressContentEditableWarning
          onBlur={e => setGimmicks(e.currentTarget.innerHTML)}
          dangerouslySetInnerHTML={{ __html: gimmicks }}
          style={{ minHeight: '100px' }}
        />
      </div>

      <div className="toolbar" style={{ marginBottom: '20px', justifyContent: 'center', background: 'transparent', border: 'none' }}>
        <button className="btn btn-add" onClick={() => addCard('statblock')}>+ 몬스터/NPC 추가</button>
        <button className="btn btn-add" onClick={() => addCard('image')}>+ 지도/이미지 추가</button>
        <button className="btn btn-add" onClick={() => addCard('text')}>+ 텍스트 노트 추가</button>
      </div>

      <div className="card-container">
        {cards.map((card: CardData) => (
          <DMCard 
            key={card.id} 
            card={card} 
            updateCard={updateCard} 
            updateStat={updateStat} 
            deleteCard={deleteCard} 
            openModal={openModal}
          />
        ))}
        {cards.length === 0 && <p style={{ textAlign: 'center', width: '100%', color: 'var(--text-muted)' }}>추가된 카드가 없습니다.</p>}
      </div>
    </div>
  );
}

function DMCard({ card, updateCard, updateStat, deleteCard, openModal }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        updateCard(card.id, { imgSrc: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const formatText = (command: string, value: string | null = null) => {
    if (savedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
    document.execCommand(command, false, value || undefined);
    if (editorRef.current) {
      updateCard(card.id, { content: editorRef.current.innerHTML });
    }
  };

  const handleAddTooltip = () => {
    if (savedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      alert('설명을 추가할 텍스트를 먼저 드래그해서 선택해주세요.');
      return;
    }
    const desc = prompt(`'${selection.toString()}'에 대한 설명을 입력하세요:`);
    if (desc) {
      const html = `<span class="keyword-tooltip" data-tooltip="${desc.replace(/"/g, '&quot;')}">${selection.toString()}</span>`;
      document.execCommand('insertHTML', false, html);
      if (editorRef.current) {
        updateCard(card.id, { content: editorRef.current.innerHTML });
      }
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('keyword-tooltip')) {
      setActiveTooltip(target.getAttribute('data-tooltip'));
    } else {
      setActiveTooltip(null);
    }
  };

  return (
    <div className={`card ${card.isRevealed ? 'revealed' : ''}`}>
      <div className="card-header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '60%' }} onClick={e => e.stopPropagation()}>
          <span style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <input 
            type="text" 
            className="card-title" 
            value={card.title} 
            onChange={e => updateCard(card.id, { title: e.target.value })} 
            style={{ width: '100%' }} 
          />
        </div>
        <div onClick={e => e.stopPropagation()}>
          <button className={`btn btn-reveal ${card.isRevealed ? 'active' : ''}`} onClick={() => updateCard(card.id, { isRevealed: !card.isRevealed })}>
            {card.isRevealed ? '👁️ 공개됨' : '🙈 숨김'}
          </button>
          <button className="btn btn-danger" style={{ padding: '8px', marginLeft: '5px' }} onClick={() => deleteCard(card.id)}>X</button>
        </div>
      </div>

      {isExpanded && (
        <div className="card-body">
          {(card.type === 'image' || card.type === 'statblock') && (
            <div style={{ marginBottom: '15px' }}>
              <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>이미지 첨부:</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ marginLeft: '10px', color: 'var(--text-main)' }} />
              {card.imgSrc && <img src={card.imgSrc} className="image-preview" onClick={() => openModal(card.imgSrc)} />}
            </div>
          )}

          {card.type === 'statblock' && (
            <div className="stats-grid">
              {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => (
                <div className="stat-box" key={stat}>
                  <span className="stat-name">{stat.toUpperCase()}</span>
                  <input type="number" className="stat-input" value={card.stats[stat]} onChange={e => updateStat(card.id, stat, parseInt(e.target.value) || 0)} />
                </div>
              ))}
            </div>
          )}

          {(card.type === 'statblock' || card.type === 'text') && (
            <>
              <div className="toolbar">
                <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('bold')}><b>B</b></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('italic')}><i>I</i></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('underline')}><u>U</u></button>
                <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 5px' }}></span>
                <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('foreColor', '#ef4444')} style={{ color: 'var(--accent-danger)', fontWeight: 'bold' }}>Red</button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('foreColor', '#3b82f6')} style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Blue</button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => formatText('foreColor', '#f3f4f6')} style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>White</button>
                <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 5px' }}></span>
                <button onMouseDown={e => e.preventDefault()} onClick={handleAddTooltip} title="텍스트를 드래그하고 클릭하세요">📝 키워드 설명</button>
              </div>
              <div 
                ref={editorRef}
                className="editor" 
                contentEditable 
                suppressContentEditableWarning
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onBlur={e => {
                  saveSelection();
                  updateCard(card.id, { content: e.currentTarget.innerHTML });
                }}
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{ __html: card.content }}
              />
            </>
          )}
        </div>
      )}

      {activeTooltip && isExpanded && (
        <div className="side-tooltip">
          <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '5px' }}>키워드 설명</strong>
          <p style={{ margin: 0, fontSize: '0.9em', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{activeTooltip}</p>
          <button className="btn" style={{ marginTop: '10px', background: '#333', padding: '4px 8px', width: '100%' }} onClick={() => setActiveTooltip(null)}>닫기</button>
        </div>
      )}
    </div>
  );
}

function PlayerDashboard({ cards, playerSheet, setPlayerSheet, playerStats, setPlayerStats, gimmicks, openModal }: any) {
  const [activeSheetTooltip, setActiveSheetTooltip] = useState<string | null>(null);
  const sheetEditorRef = useRef<HTMLDivElement>(null);
  const sheetSavedRange = useRef<Range | null>(null);

  const saveSheetSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      sheetSavedRange.current = sel.getRangeAt(0);
    }
  };

  const formatSheetText = (command: string, value: string | null = null) => {
    if (sheetSavedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(sheetSavedRange.current);
    }
    document.execCommand(command, false, value || undefined);
    if (sheetEditorRef.current) {
      const html = sheetEditorRef.current.innerHTML;
      setPlayerSheet(html);
      localStorage.setItem('dnd_player_sheet_adv', html);
    }
  };

  const handleSheetAddTooltip = () => {
    if (sheetSavedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(sheetSavedRange.current);
    }
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      alert('설명을 추가할 텍스트를 먼저 드래그해서 선택해주세요.');
      return;
    }
    const desc = prompt(`'${selection.toString()}'에 대한 설명을 입력하세요:`);
    if (desc) {
      const html = `<span class="keyword-tooltip" data-tooltip="${desc.replace(/"/g, '&quot;')}">${selection.toString()}</span>`;
      document.execCommand('insertHTML', false, html);
      if (sheetEditorRef.current) {
        const newHtml = sheetEditorRef.current.innerHTML;
        setPlayerSheet(newHtml);
        localStorage.setItem('dnd_player_sheet_adv', newHtml);
      }
    }
  };

  const handleSheetContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('keyword-tooltip')) {
      setActiveSheetTooltip(target.getAttribute('data-tooltip'));
    } else {
      setActiveSheetTooltip(null);
    }
  };

  const updatePlayerStat = (stat: keyof Stats, val: number) => {
    const newStats = { ...playerStats, [stat]: val };
    setPlayerStats(newStats);
    localStorage.setItem('dnd_player_stats_adv', JSON.stringify(newStats));
  };

  const getModifier = (score: number) => {
    let mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  return (
    <div className="dashboard">
      {/* Gimmicks & Conditions Panel (Read-Only for Players) */}
      <div className="gimmick-panel" style={{ borderColor: 'var(--border-color)' }}>
        <h2 style={{ color: 'var(--accent-danger)' }}>⚠️ 현재 세션 기믹 및 상태이상</h2>
        <div className="editor-content" dangerouslySetInnerHTML={{ __html: gimmicks }} style={{ minHeight: 'auto', background: 'rgba(0,0,0,0.2)', border: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left: Shared Cards */}
        <div className="card-container" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ width: '100%', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>공유된 정보</h3>
          {cards.map((card: CardData) => (
            <PlayerCard key={card.id} card={card} openModal={openModal} />
          ))}
          {cards.length === 0 && <p style={{ color: 'var(--text-muted)' }}>마스터가 공유한 정보가 없습니다.</p>}
        </div>

        {/* Right: Personal Character Sheet */}
        <div className="card" style={{ flex: '1 1 400px', position: 'sticky', top: '20px' }}>
          <h3 style={{ color: 'var(--accent-primary)', marginBottom: '20px' }}>내 캐릭터 시트</h3>
          
          {/* Player Stats Grid */}
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => (
              <div className="stat-box" key={stat}>
                <span className="stat-name">{stat.toUpperCase()}</span>
                <input 
                  type="number" 
                  className="stat-input" 
                  value={playerStats[stat]} 
                  onChange={e => updatePlayerStat(stat, parseInt(e.target.value) || 0)}
                />
                <span className="stat-val" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>({getModifier(playerStats[stat])})</span>
              </div>
            ))}
          </div>

          <div className="toolbar" style={{ marginBottom: '10px' }}>
            <button onMouseDown={e => e.preventDefault()} onClick={() => formatSheetText('bold')}><b>B</b></button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => formatSheetText('italic')}><i>I</i></button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => formatSheetText('underline')}><u>U</u></button>
            <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 5px' }}></span>
            <button onMouseDown={e => e.preventDefault()} onClick={() => formatSheetText('foreColor', '#ef4444')} style={{ color: 'var(--accent-danger)', fontWeight: 'bold' }}>Red</button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => formatSheetText('foreColor', '#3b82f6')} style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Blue</button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => formatSheetText('foreColor', '#f3f4f6')} style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>White</button>
            <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 5px' }}></span>
            <button onMouseDown={e => e.preventDefault()} onClick={handleSheetAddTooltip} title="텍스트를 드래그하고 클릭하세요">📝 키워드 설명</button>
          </div>
          <div 
            ref={sheetEditorRef}
            className="editor" 
            contentEditable 
            suppressContentEditableWarning
            onMouseUp={saveSheetSelection}
            onKeyUp={saveSheetSelection}
            onBlur={e => {
              saveSheetSelection();
              const html = e.currentTarget.innerHTML;
              setPlayerSheet(html);
              localStorage.setItem('dnd_player_sheet_adv', html);
            }}
            onClick={handleSheetContentClick}
            dangerouslySetInnerHTML={{ __html: playerSheet || '캐릭터의 아이템, 메모, 특성을 자유롭게 적어보세요...' }}
            style={{ minHeight: '300px' }}
          />

          {activeSheetTooltip && (
            <div className="side-tooltip" style={{ left: '-290px', top: '50px' }}>
              <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '5px' }}>키워드 설명</strong>
              <p style={{ margin: 0, fontSize: '0.9em', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{activeSheetTooltip}</p>
              <button className="btn" style={{ marginTop: '10px', background: '#333', padding: '4px 8px', width: '100%' }} onClick={() => setActiveSheetTooltip(null)}>닫기</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ card, openModal }: { card: CardData, openModal: (src: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const getModifier = (score: number) => {
    let mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('keyword-tooltip')) {
      setActiveTooltip(target.getAttribute('data-tooltip'));
    } else {
      setActiveTooltip(null);
    }
  };

  return (
    <div className={`card player-card ${card.isRevealed ? '' : 'blurred'}`}>
      <div className="secret-badge">DM SECRET<br/><span style={{ fontSize: '0.5em', color: 'var(--text-main)' }}>마스터가 비공개 중입니다</span></div>
      <div className="card-header" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--accent-primary)' }}>{isExpanded ? '▼' : '▶'}</span>
          {card.isRevealed ? card.title : '??? (미확인 개체)'}
        </div>
      </div>

      {isExpanded && (
        <div className="card-body">
          {card.imgSrc && (
            <img src={card.imgSrc} className="image-preview" onClick={() => openModal(card.imgSrc)} title="클릭하여 확대" />
          )}

          {card.type === 'statblock' && (
            <>
              <div className="stats-grid">
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => (
                  <div className="stat-box" key={stat}>
                    <span className="stat-name">{stat.toUpperCase()}</span>
                    <span className="stat-val">{card.stats[stat]} ({getModifier(card.stats[stat])})</span>
                  </div>
                ))}
              </div>
              <div className="editor-content" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: card.content }} />
            </>
          )}
          {card.type === 'text' && (
            <div className="editor-content" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: card.content }} />
          )}
        </div>
      )}

      {activeTooltip && isExpanded && (
        <div className="side-tooltip">
          <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '5px' }}>키워드 설명</strong>
          <p style={{ margin: 0, fontSize: '0.9em', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{activeTooltip}</p>
          <button className="btn" style={{ marginTop: '10px', background: '#333', padding: '4px 8px', width: '100%' }} onClick={() => setActiveTooltip(null)}>닫기</button>
        </div>
      )}
    </div>
  );
}
