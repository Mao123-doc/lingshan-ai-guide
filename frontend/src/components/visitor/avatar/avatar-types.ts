export type AvatarMotionId =
  | 'idle_a'
  | 'idle_b'
  | 'greeting_wave'
  | 'listening_focus'
  | 'thinking'
  | 'explain_a'
  | 'explain_b'
  | 'point_left'
  | 'point_right'
  | 'affirm_nod'
  | 'warning'
  | 'apology'
  | 'farewell';

export type AvatarExpressionId =
  | 'neutral'
  | 'smile'
  | 'focused'
  | 'thinking'
  | 'serious'
  | 'sorry';

export interface AvatarModelManifest {
  id: 'lingxiaochan-v1';
  modelUrl: '/models/lingxiaochan/lingxiaochan.model3.json';
  fallbackImageUrl: string;
  motions: Record<AvatarMotionId, { group: string; index: number }>;
  expressions: Record<AvatarExpressionId, number>;
}

export type AvatarScene =
  | 'greeting'
  | 'fact_explanation'
  | 'culture_story'
  | 'route_guidance'
  | 'recommendation'
  | 'warning'
  | 'apology'
  | 'farewell';

export interface PresentationHint {
  avatar_scene: AvatarScene;
  emphasis?: 'left' | 'right' | 'none';
}

export type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'failed';

export type AvatarEvent =
  | { type: 'SESSION_STARTED' }
  | { type: 'LISTENING_STARTED' }
  | { type: 'LISTENING_STOPPED' }
  | { type: 'REQUEST_STARTED' }
  | { type: 'ANSWER_READY'; scene: AvatarScene; emphasis: 'left' | 'right' | 'none' }
  | {
      type: 'PLAYBACK_STARTED';
      scene: AvatarScene;
      emphasis: 'left' | 'right' | 'none';
      playbackToken: string;
    }
  | { type: 'PLAYBACK_ENDED'; playbackToken: string }
  | { type: 'PLAYBACK_INTERRUPTED'; playbackToken: string }
  | { type: 'REQUEST_FAILED' }
  | { type: 'SESSION_ENDED' };

export interface AvatarRenderState {
  state: AvatarState;
  scene: AvatarScene;
  motion: AvatarMotionId;
  expression: AvatarExpressionId;
  speaking: boolean;
  sequence: number;
  playbackToken: string | null;
}
