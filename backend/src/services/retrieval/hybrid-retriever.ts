export type RetrievalChannel = 'vector' | 'structured' | 'keyword';

export interface RetrievalCandidate {
  canonicalId: string;
  dedupeKey: string;
  text: string;
  source: string;
  channel: RetrievalChannel;
  rank: number;
  rawScore?: number;
  metadata: Record<string, unknown>;
}

export interface FusedCandidate extends RetrievalCandidate {
  channels: RetrievalChannel[];
  rrfScore: number;
}

export interface FusionResult {
  candidates: FusedCandidate[];
  ranked: FusedCandidate[];
  channelCounts: Record<RetrievalChannel, number>;
  rrfK: number;
}

export function fuseCandidates(
  channels: Record<RetrievalChannel, RetrievalCandidate[]>,
  rrfK = 60,
): FusionResult {
  const channelCounts = {
    vector: channels.vector.length,
    structured: channels.structured.length,
    keyword: channels.keyword.length,
  };
  const fused = new Map<string, FusedCandidate>();

  for (const channel of ['vector', 'structured', 'keyword'] as RetrievalChannel[]) {
    for (const candidate of channels[channel]) {
      const contribution = 1 / (rrfK + candidate.rank);
      const current = fused.get(candidate.dedupeKey);
      if (current) {
        current.rrfScore += contribution;
        if (!current.channels.includes(channel)) current.channels.push(channel);
        continue;
      }
      fused.set(candidate.dedupeKey, {
        ...candidate,
        channels: [channel],
        rrfScore: contribution,
      });
    }
  }

  const candidates = [...fused.values()];
  const ranked = [...candidates].sort((left, right) =>
    right.rrfScore - left.rrfScore
    || left.rank - right.rank
    || left.canonicalId.localeCompare(right.canonicalId),
  );
  return { candidates, ranked, channelCounts, rrfK };
}
