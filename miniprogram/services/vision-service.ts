/**
 * vision-service.ts — 灵小禅小程序拍照识景服务
 *
 * 核心流程：
 * 1. 调起系统相机或相册选择单张照片
 * 2. 自动压缩保障网络效率与 5MB 门禁
 * 3. Base64 编码并调用真实后端 /visitor/vision/recognize
 * 4. 严格处理未配置（503）、提供方故障（502）、超时（504）与澄清状态
 */

import { visitorApi } from './api';
import { VisionRecognizeResponse } from '../types/chat';

export interface VisionProcessResult {
  success: boolean;
  data?: VisionRecognizeResponse;
  tempFilePath?: string;
  errorMessage?: string;
  errorCode?: string;
}

export const visionService = {
  /**
   * 选择或拍摄图片并调用视觉模型识别
   */
  async captureAndRecognize(sourceType: Array<'album' | 'camera'> = ['camera', 'album']): Promise<VisionProcessResult> {
    try {
      // 1. 选择或拍摄
      const tempPath = await this.chooseImage(sourceType);
      if (!tempPath) {
        return { success: false, errorMessage: '已取消选择图片' };
      }

      // 2. 压缩图片至合理尺寸
      let compressedPath = tempPath;
      try {
        const compressRes = await wx.compressImage({
          src: tempPath,
          quality: 75,
        });
        if (compressRes.tempFilePath) {
          compressedPath = compressRes.tempFilePath;
        }
      } catch (e) {
        console.warn('Image compress skipped or failed', e);
      }

      // 3. 转为 base64
      const base64Data = await this.fileToBase64(compressedPath);
      const dataUri = `data:image/jpeg;base64,${base64Data}`;

      // 4. 调用后端视觉识别接口
      const result = await visitorApi.recognizeVision(dataUri);

      return {
        success: true,
        data: result,
        tempFilePath: compressedPath,
      };
    } catch (err: any) {
      console.error('Vision recognize failed:', err);
      const code = err?.code || (err?.status === 503 ? 'VISION_NOT_CONFIGURED' : '');
      let msg = err?.error || err?.message || '识景处理失败';

      if (err?.status === 503 || code === 'VISION_NOT_CONFIGURED') {
        msg = '景区视觉识别模型尚未配置，已为您开启文字问答。您可以直接提问想了解的景点！';
      } else if (err?.status === 504 || code === 'VISION_TIMEOUT') {
        msg = '视觉识别超时，请确保网络通畅后重试。';
      } else if (err?.status === 502) {
        msg = '视觉模型提供方暂无有效响应，请换一张光线明亮清晰的正面照片重试。';
      }

      return {
        success: false,
        errorMessage: msg,
        errorCode: code,
      };
    }
  },

  chooseImage(sourceType: Array<'album' | 'camera'>): Promise<string | null> {
    return new Promise((resolve) => {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType,
          camera: 'back',
          success: (res) => {
            if (res.tempFiles && res.tempFiles.length > 0) {
              resolve(res.tempFiles[0].tempFilePath);
            } else {
              resolve(null);
            }
          },
          fail: () => resolve(null),
        });
      } else {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType,
          success: (res) => {
            resolve(res.tempFilePaths[0] || null);
          },
          fail: () => resolve(null),
        });
      }
    });
  },

  fileToBase64(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          if (typeof res.data === 'string') {
            resolve(res.data);
          } else {
            reject(new Error('读取图片格式异常'));
          }
        },
        fail: (err) => {
          reject(new Error(`读取图片失败: ${err.errMsg}`));
        },
      });
    });
  },
};
