export interface StorageProvider {
  /**
   * Write/save data to the specified destination
   * @param destination - The path or identifier where to save the data
   * @param data - The data to save (Buffer, string, or other supported types)
   * @returns Promise that resolves when the operation is complete
   */
  write(destination: string, data: Buffer | string | Uint8Array): Promise<void>;

  /**
   * Check if a file or object exists at the specified destination
   * @param destination - The path or identifier to check
   * @returns Promise that resolves to true if exists, false otherwise
   */
  exists(destination: string): Promise<boolean>;

  /**
   * Get the size of a file or object at the specified destination
   * @param destination - The path or identifier to check
   * @returns Promise that resolves to the size in bytes
   */
  getSize(destination: string): Promise<number>;

  /**
   * Ensure that the destination directory/bucket exists
   * @param destination - The directory path or bucket name
   * @returns Promise that resolves when the operation is complete
   */
  ensureDestination(destination: string): Promise<void>;
}

/**
 * Local file system storage implementation using Bun
 */
export class LocalFileSystemStorage implements StorageProvider {
  async write(destination: string, data: Buffer | string | Uint8Array): Promise<void> {
    await Bun.write(destination, data);
  }

  async exists(destination: string): Promise<boolean> {
    const file = Bun.file(destination);
    return await file.exists();
  }

  async getSize(destination: string): Promise<number> {
    const file = Bun.file(destination);
    return file.size;
  }

  async ensureDestination(destination: string): Promise<void> {
    // Create a .gitkeep file to ensure the directory exists
    const keepFile = destination.endsWith('/') ? `${destination}.gitkeep` : `${destination}/.gitkeep`;
    await Bun.write(keepFile, "");
  }
}

/*
// Example S3 storage implementation (uncomment and install aws-sdk when needed)
export class S3Storage implements StorageProvider {
  private s3Client: any; // AWS S3 client
  private bucketName: string;

  constructor(bucketName: string, s3Client: any) {
    this.bucketName = bucketName;
    this.s3Client = s3Client;
  }

  async write(destination: string, data: Buffer | string | Uint8Array): Promise<void> {
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: destination,
      Body: data,
    }).promise();
  }

  async exists(destination: string): Promise<boolean> {
    try {
      await this.s3Client.headObject({
        Bucket: this.bucketName,
        Key: destination,
      }).promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getSize(destination: string): Promise<number> {
    const result = await this.s3Client.headObject({
      Bucket: this.bucketName,
      Key: destination,
    }).promise();
    return result.ContentLength || 0;
  }

  async ensureDestination(destination: string): Promise<void> {
    // For S3, we might want to ensure the bucket exists
    // This is usually handled at the bucket level, not object level
    // Implementation depends on your specific needs
  }
}

// Example MinIO storage implementation (similar to S3)
export class MinIOStorage implements StorageProvider {
  // Similar implementation to S3Storage but with MinIO client
  // ...
}
*/

export interface StorageProviderConfig {
  type: 'local';
  // Future configs can be added here:
  // type: 'local' | 's3' | 'minio';
  // bucketName?: string;
  // region?: string;
  // credentials?: any;
}

/**
 * Factory function to create storage providers
 */
export function createStorageProvider(type: 'local' = 'local', config?: StorageProviderConfig): StorageProvider {
  switch (type) {
    case 'local':
      return new LocalFileSystemStorage();
    // Future implementations:
    // case 's3':
    //   return new S3Storage(config.bucketName, createS3Client(config));
    // case 'minio':
    //   return new MinIOStorage(config.bucketName, createMinIOClient(config));
    default:
      throw new Error(`Unsupported storage provider type: ${type}`);
  }
} 