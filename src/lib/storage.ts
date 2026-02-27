import { S3Storage } from "coze-coding-dev-sdk";

// 初始化对象存储客户端
export const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 上传 base64 图片到对象存储
export async function uploadBase64Image(
  base64Data: string,
  fileName: string
): Promise<string> {
  // 解析 base64 data URL
  // 格式: data:image/png;base64,xxxxx
  const matches = base64Data.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image format');
  }
  
  const mimeType = matches[1];
  const base64 = matches[2];
  
  // 转换为 Buffer
  const buffer = Buffer.from(base64, 'base64');
  
  // 上传到对象存储
  const key = await storage.uploadFile({
    fileContent: buffer,
    fileName: `ai-images/${fileName}`,
    contentType: mimeType,
  });
  
  return key;
}

// 获取图片的签名 URL
export async function getImageUrl(key: string, expireTime = 86400 * 30): Promise<string> {
  return storage.generatePresignedUrl({
    key,
    expireTime, // 默认 30 天有效期
  });
}

// 检查是否是 base64 data URL
export function isBase64DataUrl(url: string): boolean {
  return url.startsWith('data:image/');
}
