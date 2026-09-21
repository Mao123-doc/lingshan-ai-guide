import type { SceneState } from '../scene/scene-state';
import type { RouteGraph } from './route-contract';

export type NormalizedRoutePreferences = {
  interests: string[];
  partyType?: string;
  mobility: SceneState['mobility'];
  pace: 'slow' | 'normal' | 'fast';
  ageGroup?: string;
  budget?: SceneState['budget'];
};

const INTEREST_ALIASES: Record<string, string> = {
  历史: 'history',
  古迹: 'history',
  文化: 'culture',
  自然: 'nature',
  风景: 'nature',
  建筑: 'architecture',
  亲子: 'family',
  祈福: 'prayer',
};

const PARTY_ALIASES: Record<string, string> = {
  亲子: 'with_children',
  带长辈: 'with_elderly',
  情侣: 'couple',
  朋友: 'friends',
};

const MOBILITY_ALIASES: Record<string, SceneState['mobility']> = {
  正常: 'normal',
  行动正常: 'normal',
  少走路: 'limited',
  行动不便: 'limited',
  轮椅: 'wheelchair',
};

const PACE_ALIASES: Record<string, NormalizedRoutePreferences['pace']> = {
  轻松: 'slow',
  慢: 'slow',
  标准: 'normal',
  正常: 'normal',
  紧凑: 'fast',
  快: 'fast',
};

const BUDGET_ALIASES: Record<string, NonNullable<SceneState['budget']>> = {
  经济型: 'economy',
  经济: 'economy',
  舒适型: 'normal',
  舒适: 'normal',
  豪华型: 'premium',
  豪华: 'premium',
};

function canonicalInterest(value: string): string {
  return INTEREST_ALIASES[value] || value;
}

export function normalizeRoutePreferences(scene: SceneState): NormalizedRoutePreferences {
  const interests = [...new Set(scene.interests.map(canonicalInterest))].sort();
  const partyType = scene.partyType ? (PARTY_ALIASES[scene.partyType] || scene.partyType) : undefined;
  const mobility = MOBILITY_ALIASES[scene.mobility] || scene.mobility;
  const pace = scene.pace
    ? (PACE_ALIASES[scene.pace] || scene.pace)
    : 'normal';
  const budget = scene.budget
    ? (BUDGET_ALIASES[scene.budget] || scene.budget)
    : undefined;

  return {
    interests,
    ...(partyType ? { partyType } : {}),
    mobility,
    pace,
    ...(budget ? { budget } : {}),
  };
}

export function getVisitMinutes(
  baseMinutes: number,
  pace: NormalizedRoutePreferences['pace'],
): number {
  if (pace === 'slow') return Math.ceil(baseMinutes * 1.2);
  if (pace === 'fast') return Math.max(10, Math.ceil(baseMinutes * 0.85));
  return baseMinutes;
}

function interestMatchScore(name: string, interest: string): number {
  const patterns: Record<string, RegExp> = {
    history: /禅寺|大照壁|阿育王|无尽意/,
    culture: /大佛|梵宫|坛城|禅寺|博览馆/,
    nature: /菩提|花海|鹿鸣|湖|花街/,
    architecture: /宫|塔|门|桥|大佛/,
    family: /百子|九龙|梵宫/,
    prayer: /大佛|佛足|九龙|禅寺|弥勒/,
  };
  return patterns[interest]?.test(name) ? 25 : 0;
}

export function preferenceScore(
  spot: RouteGraph['spots'][number],
  preferences: NormalizedRoutePreferences,
): number {
  const interestScore = Math.min(
    60,
    preferences.interests.reduce((score, interest) => score + interestMatchScore(spot.name, interest), 0),
  );
  const partyScore = preferences.partyType === 'couple'
    && /拈花广场|梵天花海|香月花街|拈花堂|五灯湖/.test(spot.name)
    ? 40
    : 0;
  return interestScore + partyScore;
}
