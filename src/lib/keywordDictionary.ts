export interface KeywordDef {
  icon?: string;
  description: string;
}

export const keywordDictionary: Record<string, KeywordDef> = {
  "화염구": { icon: "🔥", description: "반경 20피트 구형으로 폭발하여 [지능 * 2]의 화염 피해를 줍니다." },
  "고블린": { icon: "👺", description: "작고 교활한 인간형 생물입니다. [민첩]이 높습니다." },
  "민첩성": { description: "캐릭터의 회피 및 민첩한 움직임을 나타냅니다. 현재: [DEX]" },
  "공격력": { icon: "⚔️", description: "기본 공격력은 [근력 * 1.5] 입니다." },
  "독": { icon: "☠️", description: "매 턴마다 [건강 * 0.5]의 피해를 입습니다." },
  "치유": { icon: "✨", description: "[지혜 * 2]만큼의 체력을 회복합니다." }
};
