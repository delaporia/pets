export class AlphaMask {
  private constructor(
    readonly width: number,
    readonly height: number,
    readonly pixels: Uint8Array,
    readonly threshold: number,
  ) {}

  static fromImageData(imageData: ImageData, threshold: number): AlphaMask {
    if (threshold < 0 || threshold > 255) {
      throw new Error("Alpha threshold must be between 0 and 255");
    }
    const pixels = new Uint8Array(imageData.width * imageData.height);
    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = imageData.data[index * 4 + 3]! >= threshold ? 255 : 0;
    }
    return new AlphaMask(imageData.width, imageData.height, pixels, threshold);
  }

  hit(x: number, y: number): boolean {
    const pixelX = Math.floor(x);
    const pixelY = Math.floor(y);
    if (
      pixelX < 0 ||
      pixelY < 0 ||
      pixelX >= this.width ||
      pixelY >= this.height
    ) {
      return false;
    }
    return this.pixels[pixelY * this.width + pixelX] === 255;
  }

  toPayload(): {
    width: number;
    height: number;
    threshold: number;
    pixels: number[];
  } {
    return {
      width: this.width,
      height: this.height,
      threshold: this.threshold,
      pixels: Array.from(this.pixels),
    };
  }
}
