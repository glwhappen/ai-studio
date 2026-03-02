import { S3Storage } from "coze-coding-dev-sdk";
import sharp from "sharp";

// 对象存储配置
interface StorageConfig {
  endpointUrl: string;
  bucketName: string;
  accessKey?: string;
  secretKey?: string;
  region?: string;
}

// 获取对象存储配置
function getStorageConfig(): StorageConfig {
  const endpointUrl = process.env.COZE_BUCKET_ENDPOINT_URL || process.env.S3_ENDPOINT_URL;
  const bucketName = process.env.COZE_BUCKET_NAME || process.env.S3_BUCKET_NAME;
  const accessKey = process.env.COZE_BUCKET_ACCESS_KEY || process.env.S3_ACCESS_KEY || "";
  const secretKey = process.env.COZE_BUCKET_SECRET_KEY || process.env.S3_SECRET_KEY || "";
  const region = process.env.COZE_BUCKET_REGION || process.env.S3_REGION || "cn-beijing";

  if (!endpointUrl) {
    throw new Error("Storage endpoint URL is not set. Please set COZE_BUCKET_ENDPOINT_URL or S3_ENDPOINT_URL in your environment variables.");
  }
  if (!bucketName) {
    throw new Error("Storage bucket name is not set. Please set COZE_BUCKET_NAME or S3_BUCKET_NAME in your environment variables.");
  }

  return { endpointUrl, bucketName, accessKey, secretKey, region };
}

// 初始化对象存储客户端
function createStorageClient(): S3Storage {
  const config = getStorageConfig();
  return new S3Storage({
    endpointUrl: config.endpointUrl,
    accessKey: config.accessKey || "",
    secretKey: config.secretKey || "",
    bucketName: config.bucketName,
    region: config.region,
  });
}

// 懒加载存储客户端
let _storage: S3Storage | null = null;
function getStorage(): S3Storage {
  if (!_storage) {
    _storage = createStorageClient();
  }
  return _storage;
}

// 缩略图配置
const THUMBNAIL_MAX_WIDTH = 400;
const THUMBNAIL_MAX_HEIGHT = 400;
const THUMBNAIL_QUALITY = 70;

// 上传 base64 图片到对象存储
export async function uploadBase64Image(
  base64Data: string,
  fileName: string
): Promise<string> {
  // 解析 base64 data URL
  // 格式: data:image/png;base64,xxxxx
  // 使用字符串分割而非正则，避免大字符串堆栈溢出
  const prefixEnd = base64Data.indexOf(',');
  if (prefixEnd === -1) {
    throw new Error('Invalid base64 image format: no comma found');
  }
  
  const prefix = base64Data.substring(0, prefixEnd);
  const base64 = base64Data.substring(prefixEnd + 1);
  
  // 解析 MIME 类型: data:image/png;base64
  if (!prefix.startsWith('data:') || !prefix.includes(';base64')) {
    throw new Error('Invalid base64 image format: wrong prefix');
  }
  
  const mimeType = prefix.substring(5, prefix.indexOf(';'));
  
  if (!mimeType.startsWith('image/')) {
    throw new Error('Invalid base64 image format: not an image');
  }
  
  // 转换为 Buffer
  const buffer = Buffer.from(base64, 'base64');
  
  // 上传到对象存储
  const key = await getStorage().uploadFile({
    fileContent: buffer,
    fileName: `ai-images/${fileName}`,
    contentType: mimeType,
  });
  
  return key;
}

// 生成缩略图并上传
export async function generateAndUploadThumbnail(
  base64Data: string,
  fileName: string
): Promise<string> {
  // 解析 base64 data URL
  const prefixEnd = base64Data.indexOf(',');
  if (prefixEnd === -1) {
    throw new Error('Invalid base64 image format: no comma found');
  }
  
  const base64 = base64Data.substring(prefixEnd + 1);
  const buffer = Buffer.from(base64, 'base64');
  
  // 使用 sharp 生成缩略图
  const thumbnailBuffer = await sharp(buffer)
    .resize(THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT, {
      fit: 'inside', // 保持宽高比，不裁剪
      withoutEnlargement: true, // 如果原图更小，不放大
    })
    .jpeg({
      quality: THUMBNAIL_QUALITY,
      mozjpeg: true, // 使用 mozjpeg 获得更好的压缩
    })
    .toBuffer();
  
  // 上传缩略图到对象存储
  const thumbnailKey = await getStorage().uploadFile({
    fileContent: thumbnailBuffer,
    fileName: `ai-thumbnails/${fileName}`,
    contentType: 'image/jpeg',
  });
  
  return thumbnailKey;
}

// 获取图片的签名 URL
export async function getImageUrl(key: string, expireTime = 86400 * 30): Promise<string> {
  return getStorage().generatePresignedUrl({
    key,
    expireTime, // 默认 30 天有效期
  });
}

// 检查是否是 base64 data URL
export function isBase64DataUrl(url: string): boolean {
  return url.startsWith('data:image/');
}

// 获取图片尺寸
export async function getImageDimensions(
  base64Data: string
): Promise<{ width: number; height: number }> {
  // 解析 base64 data URL
  const prefixEnd = base64Data.indexOf(',');
  if (prefixEnd === -1) {
    throw new Error('Invalid base64 image format: no comma found');
  }
  
  const base64 = base64Data.substring(prefixEnd + 1);
  const buffer = Buffer.from(base64, 'base64');
  
  // 使用 sharp 获取图片元数据
  const metadata = await sharp(buffer).metadata();
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}
