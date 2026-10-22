/**
 * chat.d.ts — 智能问答与多模态交互数据类型
 */

export interface RetrievedDocument {
  id?: string;
  text: string;
  score?: number;
  source: string;
}

export interface QaResponse {
  answer: string;
  conversation_id?: string;
  session_id: string;
  emotion?: 'idle' | 'greet' | 'think' | 'explain' | 'sorry' | 'happy' | string;
  related_spots?: string[];
  used_llm?: boolean;
  model?: string;
  retrieved_chunks?: string[];
  response_time_ms?: number;
  evaluation_trace?: {
    retrievedDocuments?: RetrievedDocument[];
    contextIds?: string[];
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  answer?: QaResponse;
  status?: 'pending' | 'success' | 'failed';
  errorMsg?: string;
}

export interface VisionRecognizeResponse {
  spot_name: string | null;
  confidence: number;
  description: string;
  matched: boolean;
  spot: any | null;
  spot_id: string | null;
  needs_clarification: boolean;
  source: string;
  knowledge_url: string | null;
}

export interface FeedbackInput {
  session_id: string;
  conversation_id?: string;
  rating: number; // 1 ~ 5
  comment?: string;
}
