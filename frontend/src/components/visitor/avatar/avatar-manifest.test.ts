import { describe, expect, it } from 'vitest';
import { assertValidAvatarManifest, LINGXIAOCHAN_MANIFEST } from './avatar-manifest';

describe('LINGXIAOCHAN_MANIFEST', () => {
  it('contains every competition motion and expression', () => {
    expect(() => assertValidAvatarManifest(LINGXIAOCHAN_MANIFEST)).not.toThrow();
    expect(Object.keys(LINGXIAOCHAN_MANIFEST.motions)).toHaveLength(13);
    expect(Object.keys(LINGXIAOCHAN_MANIFEST.expressions)).toHaveLength(6);
  });

  it('rejects an undeclared or duplicate renderer target', () => {
    const broken = {
      ...LINGXIAOCHAN_MANIFEST,
      motions: { ...LINGXIAOCHAN_MANIFEST.motions, warning: { group: '', index: -1 } },
    };
    expect(() => assertValidAvatarManifest(broken)).toThrow(/warning/);
  });
});
