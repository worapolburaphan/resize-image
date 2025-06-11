import sharp from "sharp";
import { join, extname } from "path";
import { createStorageProvider, type StorageProvider } from "./storage";

const ORIGINAL_FOLDER = "./original";
const OUTPUT_FOLDER = "./output";
const MAX_FILE_SIZE = 500 * 1024; // 500KB in bytes
const MAX_DIMENSION = 1024; // 1024px for longest side

// Supported image formats
const SUPPORTED_FORMATS = [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"];

// Initialize storage provider (can be easily changed to other providers in the future)
const storage: StorageProvider = createStorageProvider('local');

async function ensureOutputFolder() {
  try {
    await storage.ensureDestination(OUTPUT_FOLDER);
    console.log(`✓ Output folder "${OUTPUT_FOLDER}" is ready`);
  } catch (error) {
    console.error("Error creating output folder:", error);
    throw error;
  }
}

async function getFileSize(filePath: string): Promise<number> {
  return await storage.getSize(filePath);
}

function getExtension(fileName: string): string {
  return extname(fileName).toLowerCase();
}

function isSupportedImageFormat(fileName: string): boolean {
  return SUPPORTED_FORMATS.includes(getExtension(fileName));
}

async function resizeImage(
  inputPath: string,
  outputPath: string
): Promise<void> {
  try {
    console.log(`Processing: ${inputPath}`);

    const image = sharp(inputPath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Unable to read image dimensions");
    }

    // Calculate new dimensions while maintaining aspect ratio
    const { width, height } = metadata;
    let newWidth = width;
    let newHeight = height;

    if (width > height) {
      // Width is the longest side
      if (width > MAX_DIMENSION) {
        newWidth = MAX_DIMENSION;
        newHeight = Math.round((height * MAX_DIMENSION) / width);
      }
    } else {
      // Height is the longest side
      if (height > MAX_DIMENSION) {
        newHeight = MAX_DIMENSION;
        newWidth = Math.round((width * MAX_DIMENSION) / height);
      }
    }

    // Start with quality 95 and adjust if needed
    let quality = 95;
    let buffer: Buffer;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      attempts++;

      // Apply resize and compression
      let processedImage = image.resize(newWidth, newHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: "inside",
        withoutEnlargement: true,
      });

      // Set quality based on format
      const ext = getExtension(outputPath);

      if (ext === ".jpg" || ext === ".jpeg") {
        processedImage = processedImage.jpeg({ quality, mozjpeg: true });
      } else if (ext === ".png") {
        processedImage = processedImage.png({
          compressionLevel: Math.min(
            9,
            Math.round((9 * (100 - quality)) / 100)
          ),
          quality,
        });
      } else if (ext === ".webp") {
        processedImage = processedImage.webp({ quality });
      }

      buffer = await processedImage.toBuffer();

      // If file size is too large, reduce quality
      if (buffer.length > MAX_FILE_SIZE && quality > 10) {
        quality = Math.max(10, quality * 0.8); // Exponential decay
        console.log(`  Adjusting quality to ${quality}% (attempt ${attempts})`);
      } else {
        break;
      }
    } while (
      buffer.length > MAX_FILE_SIZE &&
      attempts < maxAttempts &&
      quality > 10
    );

    // Write the final image using the storage provider
    await storage.write(outputPath, buffer);

    const originalSize = await getFileSize(inputPath);
    const newSize = buffer.length;

    console.log(`  ✓ ${inputPath} -> ${outputPath}`);
    console.log(
      `  Size: ${(originalSize / 1024).toFixed(1)}KB -> ${(
        newSize / 1024
      ).toFixed(1)}KB`
    );
    console.log(`  Dimensions: ${width}x${height} -> ${newWidth}x${newHeight}`);
    console.log(`  Quality: ${quality}%\n`);
  } catch (error) {
    console.error(`✗ Error processing ${inputPath}:`, error);
    throw error;
  }
}

async function processAllImages(): Promise<void> {
  try {
    console.log("🖼️  Starting image resize process...\n");

    // Ensure output folder exists
    await ensureOutputFolder();

    // Use Bun's glob to get all files in the original directory
    const glob = new Bun.Glob("*");
    const files: string[] = [];

    try {
      for await (const file of glob.scan(ORIGINAL_FOLDER)) {
        files.push(file);
      }
    } catch (error) {
      console.log("Original folder does not exist or cannot be read.");
      return;
    }

    const imageFiles = files.filter(isSupportedImageFormat);

    if (imageFiles.length === 0) {
      console.log("No supported image files found in the original folder.");
      return;
    }

    console.log(`Found ${imageFiles.length} image(s) to process:\n`);

    let processedCount = 0;
    let errorCount = 0;

    // Process each image
    for (const fileName of imageFiles) {
      try {
        const inputPath = join(ORIGINAL_FOLDER, fileName);
        const outputPath = join(OUTPUT_FOLDER, fileName);

        await resizeImage(inputPath, outputPath);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process ${fileName}:`, error);
        errorCount++;
      }
    }

    console.log("🎉 Processing completed!");
    console.log(`✓ Successfully processed: ${processedCount} images`);
    if (errorCount > 0) {
      console.log(`✗ Failed to process: ${errorCount} images`);
    }
  } catch (error) {
    console.error("Error during processing:", error);
    process.exit(1);
  }
}

// Run the program
processAllImages().catch(console.error);
