import sharp from 'sharp';
import { Readable } from 'stream';
import { LicenseType } from '@prisma/client';

export interface WatermarkOptions {
  text: string;
  opacity: number;
  fontSize: number;
  position: 'center' | 'bottom-right' | 'top-left';
  color: string;
}

export class WatermarkingService {
  private static readonly DEFAULT_OPTIONS: Record<LicenseType, WatermarkOptions> = {
    [LicenseType.STANDARD]: {
      text: 'STANDARD LICENSE',
      opacity: 0.3,
      fontSize: 48,
      position: 'center',
      color: '#FF0000'
    },
    [LicenseType.EXCLUSIVE]: {
      text: 'EXCLUSIVE LICENSE',
      opacity: 0.2,
      fontSize: 36,
      position: 'bottom-right',
      color: '#0000FF'
    }
  };

  /**
   * Apply watermark to an image buffer
   */
  async applyImageWatermark(
    imageBuffer: Buffer,
    licenseType: LicenseType,
    customText?: string
  ): Promise<Buffer> {
    const options = this.getWatermarkOptions(licenseType, customText);

    try {
      // Create SVG watermark
      const svgWatermark = this.createSvgWatermark(options);

      // Apply watermark using Sharp
      const watermarkedBuffer = await sharp(imageBuffer)
        .composite([{
          input: Buffer.from(svgWatermark),
          top: this.getPositionY(options.position, 800), // Assuming 800px height, will be adjusted
          left: this.getPositionX(options.position, 1200) // Assuming 1200px width, will be adjusted
        }])
        .png()
        .toBuffer();

      return watermarkedBuffer;
    } catch (error) {
      console.error('Error applying image watermark:', error);
      throw new Error('Failed to apply watermark to image');
    }
  }

  /**
   * Apply watermark to a PDF (placeholder - would need pdf-lib or similar)
   * For now, we'll return the original buffer with a note that PDF watermarking
   * requires additional implementation
   */
  async applyPdfWatermark(
    pdfBuffer: Buffer,
    licenseType: LicenseType,
    customText?: string
  ): Promise<Buffer> {
    // TODO: Implement PDF watermarking using pdf-lib or similar library
    console.warn('PDF watermarking not yet implemented, returning original file');
    return pdfBuffer;
  }

  /**
   * Process a file buffer with watermarking
   */
  async processFileWithWatermark(
    fileBuffer: Buffer,
    mimeType: string,
    licenseType: LicenseType,
    customText?: string
  ): Promise<Buffer> {
    if (mimeType.startsWith('image/')) {
      return this.applyImageWatermark(fileBuffer, licenseType, customText);
    } else if (mimeType === 'application/pdf') {
      return this.applyPdfWatermark(fileBuffer, licenseType, customText);
    } else {
      // For other file types, return as-is (could add text file watermarking later)
      return fileBuffer;
    }
  }

  private getWatermarkOptions(licenseType: LicenseType, customText?: string): WatermarkOptions {
    const baseOptions = WatermarkingService.DEFAULT_OPTIONS[licenseType];
    return {
      ...baseOptions,
      text: customText || baseOptions.text
    };
  }

  private createSvgWatermark(options: WatermarkOptions): string {
    const { text, opacity, fontSize, color } = options;

    return `
      <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .watermark {
              font-family: Arial, sans-serif;
              font-size: ${fontSize}px;
              fill: ${color};
              opacity: ${opacity};
              font-weight: bold;
              text-anchor: middle;
              dominant-baseline: middle;
            }
          </style>
        </defs>
        <text x="200" y="100" class="watermark" transform="rotate(-45 200 100)">
          ${text}
        </text>
      </svg>
    `;
  }

  private getPositionX(position: string, imageWidth: number): number {
    switch (position) {
      case 'center':
        return imageWidth / 2 - 200; // Center horizontally
      case 'bottom-right':
        return imageWidth - 400; // Near right edge
      case 'top-left':
        return 20; // Near left edge
      default:
        return 20;
    }
  }

  private getPositionY(position: string, imageHeight: number): number {
    switch (position) {
      case 'center':
        return imageHeight / 2 - 100; // Center vertically
      case 'bottom-right':
        return imageHeight - 200; // Near bottom
      case 'top-left':
        return 20; // Near top
      default:
        return 20;
    }
  }
}

export const watermarkingService = new WatermarkingService();