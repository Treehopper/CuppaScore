/** Barcode detection for A2: the native BarcodeDetector where it reads EAN/UPC, else the zxing-wasm ponyfill. */
export interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

type NativeCtor = (new (o: { formats: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> };

/** Lazily loads the ponyfill (~1 MB wasm, bundled, no CDN) only when the native API can't do retail codes. */
export async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
  if (native) {
    const supported = (await native.getSupportedFormats?.().catch(() => [])) ?? [];
    if (supported.includes('ean_13')) return new native({ formats: FORMATS });
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  });
  return new BarcodeDetector({ formats: FORMATS as never[] });
}

export const cameraSupported = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
