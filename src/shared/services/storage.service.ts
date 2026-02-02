import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  provider: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface FileInfo {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
}

export class StorageService {
  private s3Client: S3Client | null = null;
  private config: StorageConfig | null = null;

  constructor() {
    // Defer initialization until initialize() is called
  }

  initialize() {
    if (this.config) return; // Already initialized

    this.config = {
      provider: process.env.STORAGE_PROVIDER || 'aws-s3',
      bucket: process.env.STORAGE_BUCKET || '',
      region: process.env.STORAGE_REGION || 'us-east-1',
      accessKey: process.env.STORAGE_ACCESS_KEY || '',
      secretKey: process.env.STORAGE_SECRET_KEY || ''
    };

    console.log('Storage config:', {
      provider: this.config.provider,
      bucket: this.config.bucket ? 'SET' : 'NOT SET',
      region: this.config.region,
      accessKey: this.config.accessKey ? 'SET' : 'NOT SET',
      secretKey: this.config.secretKey ? 'SET' : 'NOT SET'
    });

    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey
      }
    });
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    fileBuffer: Buffer,
    key: string,
    contentType: string,
    options: { public?: boolean } = {}
  ): Promise<UploadResult> {
    this.initialize();
    if (!this.s3Client || !this.config) {
      throw new Error('Storage service not initialized');
    }

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.bucket,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
          ACL: options.public ? 'public-read' : 'private',
          ServerSideEncryption: 'AES256'
        }
      });

      const result = await upload.done();

      return {
        key,
        url: `s3://${this.config.bucket}/${key}`,
        size: fileBuffer.length,
        contentType
      };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
        throw new Error('Storage access denied');
      }
      if (error.name === 'NoSuchBucket' || error.$metadata?.httpStatusCode === 404) {
        throw new Error('Storage bucket not found');
      }
      throw new Error('Failed to upload file to storage');
    }
  }

  /**
   * Download a file from storage
   */
  async downloadFile(key: string): Promise<Buffer> {
    this.initialize();
    if (!this.s3Client || !this.config) {
      throw new Error('Storage service not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('File not found in storage');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToByteArray();
      const buffer = await reader;
      return Buffer.from(buffer);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw new Error('File not found in storage');
      }
      throw new Error('Failed to download file from storage');
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(key: string): Promise<FileInfo> {
    this.initialize();
    if (!this.s3Client || !this.config) {
      throw new Error('Storage service not initialized');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      const response = await this.s3Client.send(command);

      return {
        key,
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date()
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      throw new Error('Failed to get file information');
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(key: string): Promise<void> {
    this.initialize();
    if (!this.s3Client || !this.config) {
      throw new Error('Storage service not initialized');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Generate a signed URL for temporary access (for downloads)
   */
  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.initialize();
    if (!this.s3Client || !this.config) {
      throw new Error('Storage service not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error('Failed to generate signed URL');
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.getFileInfo(key);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export lazy-loaded singleton instance
let _storageService: StorageService | null = null;

export const storageService = (() => {
  if (!_storageService) {
    _storageService = new StorageService();
    _storageService.initialize();
  }
  return _storageService;
})();