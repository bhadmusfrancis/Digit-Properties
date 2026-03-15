/**
 * Run Tesseract OCR in the browser on the ID front image.
 * Used so detection works reliably without depending on server Node/worker.
 */

export async function recognizeIdFrontInBrowser(file: File): Promise<string> {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(file, 'eng', {
    logger: () => {},
  });
  return result.data.text ?? '';
}
