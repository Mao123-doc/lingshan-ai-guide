export interface RAGExperimentConfig {
  enableQueryRewrite: boolean;
  enableVectorRetrieval: boolean;
  enableStructuredRetrieval: boolean;
  enableKeywordRetrieval: boolean;
  enableRerank: boolean;
  enableHistory: boolean;
  includeFullKnowledge: boolean;
  retrievalTopK: number;
  contextTopK: number;
}

export const DEFAULT_RAG_CONFIG: RAGExperimentConfig = {
  enableQueryRewrite: true,
  enableVectorRetrieval: true,
  enableStructuredRetrieval: true,
  enableKeywordRetrieval: true,
  enableRerank: true,
  enableHistory: true,
  includeFullKnowledge: true,
  retrievalTopK: 8,
  contextTopK: 5,
};

export function resolveRAGConfig(
  overrides?: Partial<RAGExperimentConfig>,
): RAGExperimentConfig {
  const config = { ...DEFAULT_RAG_CONFIG, ...(overrides || {}) };
  if (!Number.isInteger(config.retrievalTopK) || config.retrievalTopK < 1) {
    throw new Error('retrievalTopK must be a positive integer');
  }
  if (!Number.isInteger(config.contextTopK) || config.contextTopK < 1) {
    throw new Error('contextTopK must be a positive integer');
  }
  return config;
}
