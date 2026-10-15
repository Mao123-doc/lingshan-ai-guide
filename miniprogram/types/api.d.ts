/**
 * api.d.ts — 灵小禅小程序 API 基础契约类型
 */

export interface ApiResponse<T = any> {
  data: T;
  statusCode: number;
  header: Record<string, string>;
}

export interface ApiError {
  error: string;
  detail?: string;
  code?: string;
  status?: number;
}

export interface SessionInitResponse {
  session_id: string;
  welcome_message: string;
  llm_available: boolean;
  model: string;
}

export interface ServerStatusResponse {
  llm_available: boolean;
  model: string;
  knowledge_chunks: number;
  knowledge_indexed: boolean;
}

export interface DigitalHumanConfig {
  style_preset: 'zen_red_gold' | 'celadon_elegance' | 'tang_splendor' | 'ink_wash' | string;
  voice_id?: string;
  voice_speed?: number;
  voice_pitch?: number;
}
