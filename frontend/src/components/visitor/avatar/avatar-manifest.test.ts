import { describe, expect, it } from 'vitest';
import { assertValidAvatarManifest, LINGXIAOCHAN_MANIFEST } from './avatar-manifest';
import type { AvatarModelManifest } from './avatar-types';

function cloneManifest(): AvatarModelManifest {
  return structuredClone(LINGXIAOCHAN_MANIFEST);
}

describe('LINGXIAOCHAN_MANIFEST', () => {
  it('contains every competition motion and expression', () => {
    expect(() => assertValidAvatarManifest(LINGXIAOCHAN_MANIFEST)).not.toThrow();
    expect(Object.keys(LINGXIAOCHAN_MANIFEST.motions)).toHaveLength(13);
    expect(Object.keys(LINGXIAOCHAN_MANIFEST.expressions)).toHaveLength(6);
  });

  it('rejects a missing action key', () => {
    const broken = cloneManifest();
    delete (broken.motions as Partial<typeof broken.motions>).warning;

    expect(() => assertValidAvatarManifest(broken)).toThrow(/motion warning.*missing/);
  });

  it('rejects an undeclared action key', () => {
    const broken = cloneManifest();
    Object.assign(broken.motions, { dance: { group: 'Dance', index: 0 } });

    expect(() => assertValidAvatarManifest(broken)).toThrow(/motion dance.*not declared/);
  });

  it('rejects an empty action group', () => {
    const broken = cloneManifest();
    broken.motions.warning = { group: '', index: 0 };

    expect(() => assertValidAvatarManifest(broken)).toThrow(/warning.*group.*empty/);
  });

  it('rejects an invalid action index', () => {
    const broken = cloneManifest();
    broken.motions.warning = { group: 'Warning', index: -1 };

    expect(() => assertValidAvatarManifest(broken)).toThrow(/warning.*index.*non-negative integer/);
  });

  it('rejects a duplicate action target', () => {
    const broken = cloneManifest();
    broken.motions.warning = { ...broken.motions.apology };

    expect(() => assertValidAvatarManifest(broken)).toThrow(/duplicate renderer target Apology:0/);
  });

  it('rejects an invalid expression index', () => {
    const broken = cloneManifest();
    broken.expressions.serious = -1;

    expect(() => assertValidAvatarManifest(broken)).toThrow(/serious.*index.*non-negative integer/);
  });

  it('rejects a model URL outside the model directory', () => {
    const broken = cloneManifest();
    broken.modelUrl = '/models/other/model3.json' as AvatarModelManifest['modelUrl'];

    expect(() => assertValidAvatarManifest(broken)).toThrow(/modelUrl.*inside \/models\/lingxiaochan\//);
  });

  it('rejects a model URL that traverses outside the model directory', () => {
    const broken = cloneManifest();
    broken.modelUrl = '/models/lingxiaochan/../other/model3.json' as AvatarModelManifest['modelUrl'];

    expect(() => assertValidAvatarManifest(broken)).toThrow(/modelUrl.*inside \/models\/lingxiaochan\//);
  });
});
