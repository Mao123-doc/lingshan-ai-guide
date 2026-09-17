import type {
  AvatarExpressionId,
  AvatarModelManifest,
  AvatarMotionId,
} from './avatar-types';

const EXPECTED_MOTIONS: readonly AvatarMotionId[] = [
  'idle_a',
  'idle_b',
  'greeting_wave',
  'listening_focus',
  'thinking',
  'explain_a',
  'explain_b',
  'point_left',
  'point_right',
  'affirm_nod',
  'warning',
  'apology',
  'farewell',
];

const EXPECTED_EXPRESSIONS: readonly AvatarExpressionId[] = [
  'neutral',
  'smile',
  'focused',
  'thinking',
  'serious',
  'sorry',
];

export const LINGXIAOCHAN_MANIFEST: AvatarModelManifest = {
  id: 'lingxiaochan-v1',
  modelUrl: '/models/lingxiaochan/lingxiaochan.model3.json',
  fallbackImageUrl: '/images/lingxiaochan-fallback.png',
  motions: {
    idle_a: { group: 'Idle', index: 0 },
    idle_b: { group: 'Idle', index: 1 },
    greeting_wave: { group: 'Greeting', index: 0 },
    listening_focus: { group: 'Listening', index: 0 },
    thinking: { group: 'Thinking', index: 0 },
    explain_a: { group: 'Explain', index: 0 },
    explain_b: { group: 'Explain', index: 1 },
    point_left: { group: 'Point', index: 0 },
    point_right: { group: 'Point', index: 1 },
    affirm_nod: { group: 'Affirm', index: 0 },
    warning: { group: 'Warning', index: 0 },
    apology: { group: 'Apology', index: 0 },
    farewell: { group: 'Farewell', index: 0 },
  },
  expressions: {
    neutral: 0,
    smile: 1,
    focused: 2,
    thinking: 3,
    serious: 4,
    sorry: 5,
  },
};

export function assertValidAvatarManifest(manifest: AvatarModelManifest): void {
  if (!manifest.modelUrl.startsWith('/models/lingxiaochan/')) {
    throw new Error(`modelUrl: path must be inside /models/lingxiaochan/: ${manifest.modelUrl}`);
  }

  assertExactKeys('motion', manifest.motions, EXPECTED_MOTIONS);
  assertExactKeys('expression', manifest.expressions, EXPECTED_EXPRESSIONS);

  const rendererTargets = new Set<string>();
  for (const motionId of EXPECTED_MOTIONS) {
    const target = manifest.motions[motionId];
    if (!target.group.trim()) {
      throw new Error(`${motionId}: renderer group must not be empty`);
    }
    if (!Number.isInteger(target.index) || target.index < 0) {
      throw new Error(`${motionId}: renderer index must be a non-negative integer`);
    }

    const rendererTarget = `${target.group}:${target.index}`;
    if (rendererTargets.has(rendererTarget)) {
      throw new Error(`${motionId}: duplicate renderer target ${rendererTarget}`);
    }
    rendererTargets.add(rendererTarget);
  }

  for (const expressionId of EXPECTED_EXPRESSIONS) {
    const index = manifest.expressions[expressionId];
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`${expressionId}: expression index must be a non-negative integer`);
    }
  }
}

function assertExactKeys(
  label: string,
  values: object,
  expectedKeys: readonly string[],
): void {
  const actualKeys = Object.keys(values);
  for (const key of expectedKeys) {
    if (!Object.hasOwn(values, key)) {
      throw new Error(`${label} ${key}: expected key is missing`);
    }
  }
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      throw new Error(`${label} ${key}: key is not declared`);
    }
  }
}
