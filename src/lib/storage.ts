import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

// 对象存储配置
interface StorageConfig {
  endpointUrl: string;
  bucketName: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

// 获取对象存储配置
function getStorageConfig(): StorageConfig {
  const endpointUrl = process.env.COZE_BUCKET_ENDPOINT_URL || process.env.S3_ENDPOINT_URL || "";
  const bucketName = process.env.COZE_BUCKET_NAME || process.env.S3_BUCKET_NAME || "";
  const accessKey = process.env.COZE_BUCKET_ACCESS_KEY || process.env.S3_ACCESS_KEY || "";
  const secretKey = process.env.COZE_BUCKET_SECRET_KEY || process.env.S3_SECRET_KEY || "";
  const region = process.env.COZE_BUCKET_REGION || process.env.S3_REGION || "us-east-1";

  if (!endpointUrl) {
    throw new Error("Storage endpoint URL is not set. Please set COZE_BUCKET_ENDPOINT_URL or S3_ENDPOINT_URL in your environment variables.");
  }
  if (!bucketName) {
    throw new Error("Storage bucket name is not set. Please set COZE_BUCKET_NAME or S3_BUCKET_NAME in your environment variables.");
  }

  return { endpointUrl, bucketName, accessKey, secretKey, region };
}

// 创建 S3 客户端
function createS3Client(): { client: S3Client; bucketName: string } {
  const config = getStorageConfig();
  
  // 创建 S3 客户端
  const client = new S3Client({
    endpoint: config.endpointUrl,
    region: config.region,
    credentials: config.accessKey && config.secretKey ? {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    } : undefined,
    // MinIO 需要 path-style 访问
    forcePathStyle: config.endpointUrl.includes("localhost") || 
                    config.endpointUrl.includes("127.0.0.1") ||
                    config.endpointUrl.includes("minio"),
  });
  
  return { client, bucketName: config.bucketName };
}

// 懒加载 S3 客户端
let _s3: { client: S3Client; bucketName: string } | null = null;
function getS3(): { client: S3Client; bucketName: string } {
  if (!_s3) {
    _s3 = createS3Client();
  }
  return _s3;
}

// 缩略图配置
const THUMBNAIL_MAX_WIDTH = 400;
const THUMBNAIL_MAX_HEIGHT = 400;
const THUMBNAIL_QUALITY = 70;

// 上传文件到 S3
async function uploadToS3(
  key: string, 
  buffer: Buffer, 
  contentType: string
): Promise<string> {
  const { client, bucketName } = getS3();
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  
  await client.send(command);
  return key;
}

// 上传 base64 图片到对象存储
export async function uploadBase64Image(
  base64Data: string,
  fileName: string
): Promise<string> {
  // 解析 base64 data URL
  const prefixEnd = base64Data.indexOf(',');
  if (prefixEnd === -1) {
    throw new Error('Invalid base64 image format: no comma found');
  }
  
  const prefix = base64Data.substring(0, prefixEnd);
  const base64 = base64Data.substring(prefixEnd + 1);
  
  // 解析 MIME 类型
  if (!prefix.startsWith('data:') || !prefix.includes(';base64')) {
    throw new Error('Invalid base64 image format: wrong prefix');
  }
  
  const mimeType = prefix.substring(5, prefix.indexOf(';'));
  
  if (!mimeType.startsWith('image/')) {
    throw new Error('Invalid base64 image format: not an image');
  }
  
  // 转换为 Buffer
  const buffer = Buffer.from(base64, 'base64');
  
  const key = `ai-images/${fileName}`;
  return uploadToS3(key, buffer, mimeType);
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
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: THUMBNAIL_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();
  
  const thumbnailKey = `ai-thumbnails/${fileName}`;
  return uploadToS3(thumbnailKey, thumbnailBuffer, 'image/jpeg');
}

// 获取图片的签名 URL
export async function getImageUrl(key: string, expireTime = 86400 * 30): Promise<string> {
  const { client, bucketName } = getS3();
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  
  // 生成预签名 URL
  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: expireTime,
  });
  
  return signedUrl;
}

// 检查是否是 base64 data URL
export function isBase64DataUrl(url: string): boolean {
  return url.startsWith('data:image/');
}

// 获取图片尺寸
export async function getImageDimensions(
  base64Data: string
): Promise<{ width: number; height: number }> {
  const prefixEnd = base64Data.indexOf(',');
  if (prefixEnd === -1) {
    throw new Error('Invalid base64 image format: no comma found');
  }
  
  const base64 = base64Data.substring(prefixEnd + 1);
  const buffer = Buffer.from(base64, 'base64');
  
  const metadata = await sharp(buffer).metadata();
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}
