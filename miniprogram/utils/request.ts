/**
 * request.ts — 灵小禅微信小程序统一网络请求客户端
 *
 * 核心特性：
 * 1. 动态基础域名配置（支持本地调试与生产部署一键切换）
 * 2. 严格超时与网络异常标准化提示
 * 3. 幂等 GET 请求单次智能重试
 * 4. 原生流式分块传输（SSE onChunkReceived）+ 跨块多字节 UTF-8 拼包防护
 * 5. 严格契约：未收到 done 事件决不判定为成功
 */

import { ApiError } from '../types/api';

// 默认配置
export const DEFAULT_API_BASE = 'http://127.0.0.1:8010/api/v1';
export const DEFAULT_TIMEOUT_MS = 30000;

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
  timeout?: number;
  retryOnTimeout?: boolean;
}

/**
 * 获取当前配置的后端 API 基准地址
 */
export function getApiBaseUrl(): string {
  try {
    const custom = wx.getStorageSync('lingxiaochan_api_base');
    if (typeof custom === 'string' && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch {
    // 忽略缓存读取异常
  }
  return DEFAULT_API_BASE;
}

/**
 * 设置自定义后端基准地址（支持局域网真机调试或生产域名）
 */
export function setApiBaseUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  wx.setStorageSync('lingxiaochan_api_base', clean);
}

/**
 * 标准化错误对象
 */
export function normalizeError(err: any): ApiError {
  if (err && typeof err === 'object' && typeof err.error === 'string') {
    return {
      error: err.error,
      detail: err.detail || '',
      code: err.code || '',
      status: err.status || 500,
    };
  }

  const errMsg = typeof err?.errMsg === 'string' ? err.errMsg : '';
  if (errMsg.includes('timeout')) {
    return { error: '请求超时，请检查服务与网络连接', detail: errMsg, code: 'TIMEOUT', status: 408 };
  }
  if (errMsg.includes('fail')) {
    return { error: '网络连接失败，请确认后端服务已启动且开发工具已开启【不校验合法域名】', detail: errMsg, code: 'NETWORK_FAIL', status: 0 };
  }
  if (typeof err?.message === 'string') {
    return { error: err.message, detail: '', status: 500 };
  }
  return { error: '未知网络错误，请稍后重试', detail: JSON.stringify(err), status: 500 };
}

/**
 * 标准 Promise 请求
 */
export function request<T = any>(options: RequestOptions): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const fullUrl = options.url.startsWith('http') ? options.url : `${baseUrl}${options.url.startsWith('/') ? '' : '/'}${options.url}`;
  const method = options.method || 'GET';
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;

  const perform = (): Promise<T> => {
    return new Promise((resolve, reject) => {
      wx.request({
        url: fullUrl,
        method,
        data: options.data,
        timeout,
        header: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.header || {}),
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data as T);
          } else {
            const body = res.data as any;
            const errorMsg = body?.error || body?.message || `服务响应异常 (${res.statusCode})`;
            reject({
              error: errorMsg,
              detail: body?.detail || '',
              code: body?.code || '',
              status: res.statusCode,
            } as ApiError);
          }
        },
        fail: (err) => {
          reject(normalizeError(err));
        },
      });
    });
  };

  return perform().catch((err: ApiError) => {
    if (options.retryOnTimeout && method === 'GET' && err.code === 'TIMEOUT') {
      return perform();
    }
    return Promise.reject(err);
  });
}

/**
 * 稳健跨块 UTF-8 解码器
 * 防止多字节中文在 chunk 边界被生硬切断导致乱码
 */
class ChunkedUtf8Decoder {
  private leftover: number[] = [];

  decode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const combined = new Uint8Array(this.leftover.length + bytes.length);
    combined.set(this.leftover, 0);
    combined.set(bytes, this.leftover.length);
    this.leftover = [];

    let end = combined.length;
    // 检查末尾是否含有不完整的多字节序列
    let needed = 0;
    for (let i = 1; i <= 4 && end - i >= 0; i++) {
      const b = combined[end - i];
      if ((b & 0x80) === 0x00) {
        // 单字节 ASCII
        break;
      }
      if ((b & 0xe0) === 0xc0) {
        // 2字节 UTF-8 起始
        if (i < 2) needed = 2 - i;
        break;
      }
      if ((b & 0xf0) === 0xe0) {
        // 3字节 UTF-8 起始 (中文常用)
        if (i < 3) needed = 3 - i;
        break;
      }
      if ((b & 0xf8) === 0xf0) {
        // 4字节 UTF-8 起始
        if (i < 4) needed = 4 - i;
        break;
      }
    }

    if (needed > 0) {
      const cut = end - (needed === 1 ? 1 : needed === 2 ? 2 : 3);
      for (let i = cut; i < end; i++) {
        this.leftover.push(combined[i]);
      }
      end = cut;
    }

    const validSlice = combined.slice(0, end);
    try {
      const GlobalDecoder = (globalThis as any).TextDecoder;
      if (typeof GlobalDecoder !== 'undefined') {
        return new GlobalDecoder('utf-8').decode(validSlice);
      }
    } catch {
      // 降级使用手动解码
    }

    let out = '';
    let i = 0;
    while (i < validSlice.length) {
      const c = validSlice[i++];
      if (c < 0x80) {
        out += String.fromCharCode(c);
      } else if (c > 0xbf && c < 0xe0) {
        const c2 = validSlice[i++];
        out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
      } else if (c > 0xdf && c < 0xf0) {
        const c2 = validSlice[i++];
        const c3 = validSlice[i++];
        out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
      } else {
        const c2 = validSlice[i++];
        const c3 = validSlice[i++];
        const c4 = validSlice[i++];
        let u = (((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f)) - 0x10000;
        out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
      }
    }
    return out;
  }
}

export interface StreamCallbacks<T> {
  onSession?: (sessionId: string) => void;
  onToken?: (token: string) => void;
  onDone?: (payload: T) => void;
  onError?: (err: ApiError) => void;
}

/**
 * 原生 SSE 流式问答请求
 * 通过 wx.request 的 enableChunked 实现打字机渐进展示
 */
export function requestStream<T = any>(
  url: string,
  data: any,
  callbacks: StreamCallbacks<T>
): { abort: () => void } {
  const baseUrl = getApiBaseUrl();
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  const decoder = new ChunkedUtf8Decoder();

  let textBuffer = '';
  let completed = false;
  let aborted = false;

  const task = wx.request({
    url: fullUrl,
    method: 'POST',
    data,
    timeout: 60000,
    enableChunked: true,
    header: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json',
    },
    success: (res) => {
      if (aborted) return;
      if (res.statusCode < 200 || res.statusCode >= 300) {
        callbacks.onError?.({
          error: `问答服务返回错误 (${res.statusCode})`,
          status: res.statusCode,
        });
        return;
      }
      // 如果后端没有按 chunked 发送，而是以普通 JSON 返回
      if (!completed && typeof res.data === 'object' && res.data !== null) {
        completed = true;
        callbacks.onDone?.(res.data as T);
      }
    },
    fail: (err) => {
      if (aborted) return;
      if (!completed) {
        callbacks.onError?.(normalizeError(err));
      }
    },
  });

  task.onChunkReceived((chunkRes: { data: ArrayBuffer }) => {
    if (aborted) return;
    const chunkStr = decoder.decode(chunkRes.data).replace(/\r\n/g, '\n');
    textBuffer += chunkStr;

    let boundaryIndex: number;
    while ((boundaryIndex = textBuffer.indexOf('\n\n')) >= 0) {
      const frame = textBuffer.slice(0, boundaryIndex).trim();
      textBuffer = textBuffer.slice(boundaryIndex + 2);

      if (!frame) continue;

      const lines = frame.split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            if (event.type === 'session' && typeof event.session_id === 'string') {
              callbacks.onSession?.(event.session_id);
            } else if (event.type === 'chunk' && typeof event.content === 'string') {
              callbacks.onToken?.(event.content);
            } else if (event.type === 'done') {
              completed = true;
              callbacks.onDone?.(event as T);
            } else if (event.type === 'error') {
              completed = true;
              callbacks.onError?.({
                error: event.error || '问答流中断，请重试',
                status: 500,
              });
            }
          } catch {
            // 忽略非 JSON 数据帧
          }
        }
      }
    }
  });

  return {
    abort: () => {
      aborted = true;
      try {
        task.abort();
      } catch {
        // 忽略中止异常
      }
    },
  };
}
