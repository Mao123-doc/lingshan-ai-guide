import { describe, expect, it } from 'vitest';
import {
  initialAvatarState,
  reduceAvatarState,
  selectSpeakingMotion,
} from './avatar-controller';
import type { AvatarEvent } from './avatar-types';

describe('avatar controller', () => {
  it('follows the greeting, thinking, route speaking, and interruption sequence', () => {
    const initial = initialAvatarState(7);
    const greeting = reduceAvatarState(initial, { type: 'SESSION_STARTED' });
    expect(greeting.motion).toBe('greeting_wave');

    const thinking = reduceAvatarState(greeting, { type: 'REQUEST_STARTED' });
    expect(thinking).toMatchObject({ state: 'thinking', motion: 'thinking', speaking: false });

    const speaking = reduceAvatarState(thinking, {
      type: 'PLAYBACK_STARTED',
      scene: 'route_guidance',
      emphasis: 'right',
      playbackToken: 'message-1',
    });
    expect(speaking).toMatchObject({
      state: 'speaking',
      motion: 'point_right',
      expression: 'focused',
      speaking: true,
    });

    const interrupted = reduceAvatarState(speaking, {
      type: 'PLAYBACK_INTERRUPTED',
      playbackToken: 'message-1',
    });
    expect(interrupted).toMatchObject({
      state: 'interrupted',
      speaking: false,
      expression: 'neutral',
    });
  });

  it('maps every speaking scene with the required deterministic selector', () => {
    expect(selectSpeakingMotion('route_guidance', 'left', 0)).toBe('point_left');
    expect(selectSpeakingMotion('route_guidance', 'right', 0)).toBe('point_right');
    expect(selectSpeakingMotion('route_guidance', 'none', 0)).toBe('point_right');
    expect(selectSpeakingMotion('warning', 'none', 0)).toBe('warning');
    expect(selectSpeakingMotion('apology', 'none', 0)).toBe('apology');
    expect(selectSpeakingMotion('recommendation', 'none', 0)).toBe('affirm_nod');
    expect(selectSpeakingMotion('culture_story', 'none', 2)).toBe('explain_a');
    expect(selectSpeakingMotion('culture_story', 'none', 3)).toBe('explain_b');
    expect(selectSpeakingMotion('greeting', 'none', 0)).toBe('explain_a');
    expect(selectSpeakingMotion('fact_explanation', 'none', 0)).toBe('explain_a');
    expect(selectSpeakingMotion('farewell', 'none', 0)).toBe('explain_a');
  });

  it('uses apology for request failures and farewell for session end', () => {
    const failed = reduceAvatarState(initialAvatarState(4), { type: 'REQUEST_FAILED' });
    expect(failed).toMatchObject({
      state: 'failed',
      scene: 'apology',
      motion: 'apology',
      expression: 'sorry',
      speaking: false,
      playbackToken: null,
    });

    const ended = reduceAvatarState(failed, { type: 'SESSION_ENDED' });
    expect(ended).toMatchObject({
      state: 'idle',
      scene: 'farewell',
      motion: 'farewell',
      expression: 'smile',
      speaking: false,
      playbackToken: null,
    });
  });

  it('never combines a warning motion with a smile', () => {
    const warning = reduceAvatarState(initialAvatarState(1), {
      type: 'PLAYBACK_STARTED',
      scene: 'warning',
      emphasis: 'none',
      playbackToken: 'warning-1',
    });

    expect(warning.motion).toBe('warning');
    expect(warning.expression).toBe('serious');
    expect(warning.expression).not.toBe('smile');
  });

  it('replays identical seed and event sequences identically', () => {
    const events: AvatarEvent[] = [
      { type: 'SESSION_STARTED' },
      { type: 'LISTENING_STARTED' },
      { type: 'LISTENING_STOPPED' },
      { type: 'REQUEST_STARTED' },
      { type: 'ANSWER_READY', scene: 'culture_story', emphasis: 'none' },
      {
        type: 'PLAYBACK_STARTED',
        scene: 'culture_story',
        emphasis: 'none',
        playbackToken: 'story-1',
      },
      { type: 'PLAYBACK_ENDED', playbackToken: 'story-1' },
    ];
    const replay = () =>
      events.reduce(reduceAvatarState, initialAvatarState(12));

    expect(replay()).toEqual(replay());
  });

  it('ignores stale playback completion and interruption tokens', () => {
    const speaking = reduceAvatarState(initialAvatarState(3), {
      type: 'PLAYBACK_STARTED',
      scene: 'fact_explanation',
      emphasis: 'none',
      playbackToken: 'active',
    });

    const staleEnd = reduceAvatarState(speaking, {
      type: 'PLAYBACK_ENDED',
      playbackToken: 'stale',
    });
    const staleInterruption = reduceAvatarState(speaking, {
      type: 'PLAYBACK_INTERRUPTED',
      playbackToken: 'stale',
    });

    expect(staleEnd).toBe(speaking);
    expect(staleInterruption).toBe(speaking);
    expect(staleEnd).toMatchObject({
      state: 'speaking',
      speaking: true,
      playbackToken: 'active',
      sequence: speaking.sequence,
    });
  });

  it('stores answer scene and emphasis outcome without starting speech', () => {
    const thinking = reduceAvatarState(initialAvatarState(2), { type: 'REQUEST_STARTED' });
    const ready = reduceAvatarState(thinking, {
      type: 'ANSWER_READY',
      scene: 'route_guidance',
      emphasis: 'left',
    });

    expect(ready).toMatchObject({
      state: 'thinking',
      scene: 'route_guidance',
      motion: 'point_left',
      expression: 'focused',
      speaking: false,
      playbackToken: null,
    });
  });

  it('handles listening transitions and playback end as safe non-speaking states', () => {
    const listening = reduceAvatarState(initialAvatarState(8), { type: 'LISTENING_STARTED' });
    expect(listening).toMatchObject({
      state: 'listening',
      motion: 'listening_focus',
      expression: 'focused',
      speaking: false,
    });

    const stopped = reduceAvatarState(listening, { type: 'LISTENING_STOPPED' });
    expect(stopped).toMatchObject({
      state: 'idle',
      motion: 'idle_a',
      expression: 'neutral',
      speaking: false,
      playbackToken: null,
    });

    const speaking = reduceAvatarState(stopped, {
      type: 'PLAYBACK_STARTED',
      scene: 'culture_story',
      emphasis: 'none',
      playbackToken: 'story-2',
    });
    const ended = reduceAvatarState(speaking, {
      type: 'PLAYBACK_ENDED',
      playbackToken: 'story-2',
    });
    expect(ended).toMatchObject({
      state: 'idle',
      motion: 'idle_a',
      expression: 'neutral',
      speaking: false,
      playbackToken: null,
    });
  });

  it('increments sequence only for accepted events from the deterministic seed', () => {
    const initial = initialAvatarState(7);
    expect(initial).toMatchObject({ sequence: 7, motion: 'idle_b' });

    const listening = reduceAvatarState(initial, { type: 'LISTENING_STARTED' });
    expect(listening.sequence).toBe(8);

    const speaking = reduceAvatarState(listening, {
      type: 'PLAYBACK_STARTED',
      scene: 'culture_story',
      emphasis: 'none',
      playbackToken: 'active',
    });
    expect(speaking).toMatchObject({ sequence: 9, motion: 'explain_b' });

    const stale = reduceAvatarState(speaking, {
      type: 'PLAYBACK_ENDED',
      playbackToken: 'old',
    });
    expect(stale.sequence).toBe(9);

    const ended = reduceAvatarState(stale, {
      type: 'PLAYBACK_ENDED',
      playbackToken: 'active',
    });
    expect(ended).toMatchObject({ sequence: 10, motion: 'idle_a' });
  });
});
