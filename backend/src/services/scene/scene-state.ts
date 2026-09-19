import { z } from 'zod';

export const PERFORMANCE_IDS = {
  JIXIANGSONG: 'performance_lingshan_jixiangsong',
  JIULONG: 'performance_jiulong_guanyu',
} as const;

const SPOT_ALIASES: Array<{ id: string; names: string[] }> = [
  { id: 'LS-011', names: ['灵山大佛', '大佛'] },
  { id: 'LS-006', names: ['九龙灌浴', '九龙'] },
  { id: 'LS-013', names: ['灵山梵宫', '梵宫'] },
  { id: 'LS-014', names: ['五印坛城', '坛城'] },
  { id: 'LS-010', names: ['祥符禅寺', '禅寺'] },
  { id: 'LS-001', names: ['灵山大照壁', '大照壁'] },
  { id: 'LS-005', names: ['菩提大道'] },
  { id: 'LS-009', names: ['百子戏弥勒'] },
  { id: 'LS-015', names: ['曼飞龙塔'] },
  { id: 'LS-016', names: ['无尽意斋'] },
  { id: 'LS-003', names: ['佛足坛'] },
  { id: 'LS-004', names: ['五智门'] },
  { id: 'LS-008', names: ['阿育王柱'] },
  { id: 'LS-012', names: ['佛教文化博物馆', '佛教文化博览馆'] },
  { id: 'NH-002', names: ['梵天花海'] },
  { id: 'NH-006', names: ['鹿鸣谷'] },
];

const chineseDigits: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

export const SceneStateSchema = z.object({
  currentLocation: z.string().optional(),
  currentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  remainingMinutes: z.number().int().positive().optional(),
  partyType: z.string().min(1).optional(),
  mobility: z.enum(['normal', 'limited', 'wheelchair', 'unknown']),
  mealRequested: z.boolean().optional(),
  interests: z.array(z.string()),
  mustVisitSpotIds: z.array(z.string()),
  preferredPerformanceIds: z.array(z.string()),
  preferredPerformanceTimes: z.record(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).optional(),
  visitedSpotIds: z.array(z.string()),
  budget: z.enum(['economy', 'normal', 'premium']).optional(),
  pace: z.enum(['slow', 'normal', 'fast']).optional(),
  missingCriticalFields: z.array(z.string()),
});

export type SceneState = z.infer<typeof SceneStateSchema>;

function parseChineseInteger(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '十') return 10;
  if (value.length === 2 && value[0] === '十' && chineseDigits[value[1]] !== undefined) {
    return 10 + chineseDigits[value[1]];
  }
  if (value.length === 2 && chineseDigits[value[0]] !== undefined && value[1] === '十') {
    return chineseDigits[value[0]] * 10;
  }
  return chineseDigits[value];
}

function extractRemainingMinutes(query: string): number | undefined {
  if (/一个半小时/.test(query)) return 90;
  const hourMatch = query.match(/([\d一二两三四五六七八九十]+)个?小时/);
  const minuteMatch = query.match(/([\d一二两三四五六七八九十]+)分钟/);
  const hasHalf = query.includes('半小时');
  const hours = hourMatch ? parseChineseInteger(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseChineseInteger(minuteMatch[1]) : 0;
  if (!hours && !minutes && !hasHalf) return undefined;
  return (hours || 0) * 60 + (minutes || 0) + (hasHalf ? 30 : 0);
}

function extractClock(query: string): string | undefined {
  const digital = query.match(/(?:现在|当前|时间是)\s*(?:是\s*)?([01]?\d|2[0-3])[:：]([0-5]\d)/);
  if (digital) return `${digital[1].padStart(2, '0')}:${digital[2]}`;
  const chinese = query.match(/(?:现在|当前|时间是|现在是|当前是)\s*(上午|下午|早上|晚上|中午)?\s*([一二两三四五六七八九十\d]{1,3})点(半)?/);
  if (!chinese) return undefined;
  const hour = parseChineseInteger(chinese[2]);
  if (hour === undefined || hour > 23) return undefined;
  const adjusted = chinese[1] && ['下午', '晚上'].includes(chinese[1]) && hour < 12 ? hour + 12 : hour;
  return `${String(adjusted).padStart(2, '0')}:${chinese[3] ? '30' : '00'}`;
}

function clockToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
}

function inferCurrentTimeFromPerformance(
  performanceTimes: Record<string, string> | undefined,
  remainingMinutes: number | undefined,
  query: string,
): string | undefined {
  if (!performanceTimes || remainingMinutes === undefined) return undefined;
  if (!/(只有|还有|还剩|剩下|剩余)/.test(query)) return undefined;
  const performanceTime = Object.values(performanceTimes)[0];
  if (!performanceTime) return undefined;
  const inferredMinutes = clockToMinutes(performanceTime) - remainingMinutes;
  return inferredMinutes >= 0 ? minutesToClock(inferredMinutes) : undefined;
}

function extractTimeRange(query: string): { start: string; durationMinutes: number } | undefined {
  const rangeClause = query.match(/从[^。！？!?；;]+到[^。！？!?；;]+/)?.[0];
  if (!rangeClause) return undefined;
  const timeMatches = [...rangeClause.matchAll(TIME_TOKEN_PATTERN)];
  if (timeMatches.length < 2) return undefined;
  const start = parseTimeToken(timeMatches[0]);
  const end = parseTimeToken(timeMatches[1]);
  if (!start || !end) return undefined;
  const durationMinutes = clockToMinutes(end) - clockToMinutes(start);
  return durationMinutes > 0 ? { start, durationMinutes } : undefined;
}

function detectLocation(query: string): string | undefined {
  if (/(景区)?入口|南门/.test(query)) return 'south_gate';
  const locationPhrase = query.match(/(?:现在|目前|当前)?在([^，。,.]+)/)?.[1] || '';
  for (const spot of SPOT_ALIASES) {
    if (spot.names.some(name => locationPhrase.includes(name))) return spot.id;
  }
  for (const spot of SPOT_ALIASES) {
    if (spot.names.some(name => query.includes(name)) && /(在|从|位于|到达|到了|目前)/.test(query)) {
      return spot.id;
    }
  }
  return undefined;
}

function detectPartyType(query: string): string | undefined {
  if (/妈妈|母亲|老人|长辈|父母|爸爸|爷爷|奶奶/.test(query)) return 'with_elderly';
  if (/孩子|儿童|小朋友|宝宝/.test(query)) return 'with_children';
  if (/情侣|爱人|女朋友|男朋友|对象|伴侣|夫妻/.test(query)) return 'couple';
  if (/朋友|同学/.test(query)) return 'friends';
  return undefined;
}

function detectMealIntent(query: string): boolean {
  return /吃饭|午饭|午餐|晚饭|晚餐|用餐|餐厅|餐馆/.test(query);
}

function detectMobility(query: string): SceneState['mobility'] {
  if (/轮椅|坐轮椅/.test(query)) return 'wheelchair';
  if (/腿脚不方便|行动不便|走不动|少走路|不能久走/.test(query)) return 'limited';
  if (/步行正常|行动方便|不怕走路/.test(query)) return 'normal';
  return 'unknown';
}

function detectInterests(query: string): string[] {
  const interests: string[] = [];
  const matches: Array<[string, RegExp]> = [
    ['history', /历史|古迹|古刹|年代/],
    ['culture', /文化|佛教|禅|艺术/],
    ['nature', /自然|风景|花海|太湖/],
    ['architecture', /建筑|楼|塔|宫/],
    ['family', /亲子|孩子/],
    ['prayer', /祈福|拜佛|烧香/],
  ];
  for (const [interest, pattern] of matches) if (pattern.test(query)) interests.push(interest);
  return interests;
}

function detectMustVisitSpotIds(query: string): string[] {
  if (!/必须|一定要|想去|想看|要去|重点看|希望去/.test(query)) return [];
  return SPOT_ALIASES.filter(spot => spot.names.some(name => query.includes(name))).map(spot => spot.id);
}

function detectVisitedSpotIds(query: string): string[] {
  if (!/已经|已|去过|看过|游览过|参观过/.test(query)) return [];
  const visitedPhrase = query.match(/(?:已经|已|去过|看过|游览过|参观过)([^。]+)/)?.[1] || '';
  return SPOT_ALIASES.filter(spot => spot.names.some(name => visitedPhrase.includes(name))).map(spot => spot.id);
}

const TIME_TOKEN_PATTERN = /(上午|下午|早上|晚上)?\s*([一二两三四五六七八九十\d]{1,3})(?:(?::|：)([0-5]\d)|点(半)?)/g;

function parseTimeToken(match: RegExpMatchArray): string | undefined {
  const hour = parseChineseInteger(match[2]);
  if (hour === undefined || hour > 23) return undefined;
  const minute = match[3] || (match[4] ? '30' : '00');
  const adjusted = match[1] && ['下午', '晚上'].includes(match[1]) && hour < 12
    ? hour + 12
    : !match[1] && hour > 0 && hour < 8 ? hour + 12 : hour;
  return `${String(adjusted).padStart(2, '0')}:${minute}`;
}

function isCurrentTimeToken(clause: string, match: RegExpMatchArray): boolean {
  const start = match.index ?? 0;
  const prefix = clause.slice(Math.max(0, start - 12), start);
  return /(?:现在是|当前是|现在|当前|时间是)\s*(?:上午|下午|早上|晚上)?\s*$/.test(prefix);
}

function detectPerformance(query: string): { ids: string[]; times?: Record<string, string> } {
  const performance = query.includes('吉祥颂') || query.includes('灵山吉祥颂')
    ? PERFORMANCE_IDS.JIXIANGSONG
    : query.includes('九龙灌浴') && /表演|演出|场/.test(query)
      ? PERFORMANCE_IDS.JIULONG
      : undefined;
  if (!performance) return { ids: [] };
  const marker = performance === PERFORMANCE_IDS.JIXIANGSONG ? '吉祥颂' : '九龙灌浴';
  const clause = query.split(/[，。！？!?；;]/).find(part => part.includes(marker)) || query;
  const markerIndex = clause.indexOf(marker);
  const timeMatches = [...clause.matchAll(TIME_TOKEN_PATTERN)]
    .filter(match => !isCurrentTimeToken(clause, match))
    .sort((left, right) => Math.abs((left.index ?? 0) - markerIndex) - Math.abs((right.index ?? 0) - markerIndex));
  const time = timeMatches[0];
  if (!time) return { ids: [performance] };
  const parsed = parseTimeToken(time);
  return parsed ? { ids: [performance], times: { [performance]: parsed } } : { ids: [performance] };
}

export function extractSceneState(query: string): SceneState {
  const currentLocation = detectLocation(query);
  const timeRange = extractTimeRange(query);
  const remainingMinutes = extractRemainingMinutes(query) ?? timeRange?.durationMinutes;
  const performance = detectPerformance(query);
  const currentTime = extractClock(query)
    ?? timeRange?.start
    ?? inferCurrentTimeFromPerformance(performance.times, remainingMinutes, query);
  const missingCriticalFields: string[] = [];
  if (!currentLocation) missingCriticalFields.push('currentLocation');
  if (remainingMinutes === undefined) missingCriticalFields.push('remainingMinutes');
  if (performance.ids.length > 0 && !currentTime) missingCriticalFields.push('currentTime');

  return SceneStateSchema.parse({
    ...(currentLocation ? { currentLocation } : {}),
    ...(currentTime ? { currentTime } : {}),
    ...(remainingMinutes !== undefined ? { remainingMinutes } : {}),
    ...(detectPartyType(query) ? { partyType: detectPartyType(query) } : {}),
    mobility: detectMobility(query),
    ...(detectMealIntent(query) ? { mealRequested: true } : {}),
    interests: detectInterests(query),
    mustVisitSpotIds: detectMustVisitSpotIds(query),
    preferredPerformanceIds: performance.ids,
    ...(performance.times ? { preferredPerformanceTimes: performance.times } : {}),
    visitedSpotIds: detectVisitedSpotIds(query),
    missingCriticalFields,
  });
}
