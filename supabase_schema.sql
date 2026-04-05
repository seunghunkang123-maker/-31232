-- D&D 5e Session Hub Supabase Schema
-- 이 코드를 복사하여 Supabase 대시보드의 SQL Editor에서 실행하세요.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Sessions Table (세션 정보)
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    dm_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Cards Table (몬스터, NPC, 이미지, 텍스트 노트)
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

-- 3. Player Sheets Table (플레이어 캐릭터 시트)
CREATE TABLE public.player_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    character_name TEXT DEFAULT '새 캐릭터',
    content TEXT,
    stats JSONB DEFAULT '{"str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10}'::jsonb,
    UNIQUE(user_id, session_id)
);

-- 4. Global Wiki Table (캠페인 위키)
CREATE TABLE public.wikis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Initiative Tracker Table (우선권 추적기)
CREATE TABLE public.initiatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 초기 위키 데이터 삽입
INSERT INTO public.wikis (content) VALUES ('여기에 캠페인 전반의 세계관, NPC, 범용 키워드 등을 기록하세요.');

-- 프로토타입을 위한 RLS(Row Level Security) 비활성화
-- (실제 서비스 배포 시에는 RLS를 활성화하고 적절한 정책을 설정해야 합니다)
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wikis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiatives DISABLE ROW LEVEL SECURITY;
