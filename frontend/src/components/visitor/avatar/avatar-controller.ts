import type {
  AvatarEvent,
  AvatarExpressionId,
  AvatarMotionId,
  AvatarRenderState,
  AvatarScene,
} from './avatar-types';

type AvatarEmphasis = 'left' | 'right' | 'none';

const SCENE_EXPRESSIONS: Record<AvatarScene, AvatarExpressionId> = {
  greeting: 'smile',
  fact_explanation: 'focused',
  culture_story: 'smile',
  route_guidance: 'focused',
  recommendation: 'smile',
  warning: 'serious',
  apology: 'sorry',
  farewell: 'smile',
};

function selectIdleMotion(sequence: number): AvatarMotionId {
  return sequence % 2 === 0 ? 'idle_a' : 'idle_b';
}

export function selectSpeakingMotion(
  scene: AvatarScene,
  emphasis: AvatarEmphasis,
  sequence: number,
): AvatarMotionId {
  if (scene === 'route_guidance') {
    return emphasis === 'left' ? 'point_left' : 'point_right';
  }

  const fixedMotions: Partial<Record<AvatarScene, AvatarMotionId>> = {
    warning: 'warning',
    apology: 'apology',
    recommendation: 'affirm_nod',
  };
  const fixedMotion = fixedMotions[scene];
  if (fixedMotion) {
    return fixedMotion;
  }

  if (scene === 'culture_story') {
    return sequence % 2 === 0 ? 'explain_a' : 'explain_b';
  }

  return 'explain_a';
}

export function initialAvatarState(sessionSeed: number): AvatarRenderState {
  return {
    state: 'idle',
    scene: 'greeting',
    motion: selectIdleMotion(sessionSeed),
    expression: 'neutral',
    speaking: false,
    sequence: sessionSeed,
    playbackToken: null,
  };
}

export function reduceAvatarState(
  state: AvatarRenderState,
  event: AvatarEvent,
): AvatarRenderState {
  if (
    (event.type === 'PLAYBACK_ENDED' || event.type === 'PLAYBACK_INTERRUPTED') &&
    event.playbackToken !== state.playbackToken
  ) {
    return state;
  }

  const sequence = state.sequence + 1;

  switch (event.type) {
    case 'SESSION_STARTED':
      return {
        ...state,
        state: 'idle',
        scene: 'greeting',
        motion: 'greeting_wave',
        expression: 'smile',
        speaking: false,
        sequence,
        playbackToken: null,
      };
    case 'LISTENING_STARTED':
      return {
        ...state,
        state: 'listening',
        motion: 'listening_focus',
        expression: 'focused',
        speaking: false,
        sequence,
        playbackToken: null,
      };
    case 'LISTENING_STOPPED':
    case 'PLAYBACK_ENDED':
      return {
        ...state,
        state: 'idle',
        motion: selectIdleMotion(sequence),
        expression: 'neutral',
        speaking: false,
        sequence,
        playbackToken: null,
      };
    case 'REQUEST_STARTED':
      return {
        ...state,
        state: 'thinking',
        motion: 'thinking',
        expression: 'thinking',
        speaking: false,
        sequence,
        playbackToken: null,
      };
    case 'ANSWER_READY':
      return {
        ...state,
        scene: event.scene,
        motion: selectSpeakingMotion(event.scene, event.emphasis, sequence),
        expression: SCENE_EXPRESSIONS[event.scene],
        speaking: false,
        sequence,
        playbackToken: null,
      };
    case 'PLAYBACK_STARTED':
      return {
        ...state,
        state: 'speaking',
        scene: event.scene,
        motion: selectSpeakingMotion(event.scene, event.emphasis, sequence),
        expression: SCENE_EXPRESSIONS[event.scene],
        speaking: true,
        sequence,
        playbackToken: event.playbackToken,
      };
    case 'PLAYBACK_INTERRUPTED':
      return {
        ...state,
        state: 'interrupted',
        motion: selectIdleMotion(sequence),
        expression: 'neutral',
        speaking: false,
        sequence,
        playbackToken: null,
      };
    case 'REQUEST_FAILED':
      return {
        ...state,
        state: 'failed',
        scene: 'apology',
        motion: 'apology',
        expression: 'sorry',
        speaking: false,
        sequence,
        playbackToken: null,
      };
    case 'SESSION_ENDED':
      return {
        ...state,
        state: 'idle',
        scene: 'farewell',
        motion: 'farewell',
        expression: 'smile',
        speaking: false,
        sequence,
        playbackToken: null,
      };
  }
}
