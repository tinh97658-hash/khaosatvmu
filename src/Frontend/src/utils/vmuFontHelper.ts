import type { jsPDF } from 'jspdf';

let regularFontBase64: string | null = null;
let boldFontBase64: string | null = null;
let fontLoadPromise: Promise<void> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function ensureVmuFontsLoaded(): Promise<void> {
  if (regularFontBase64 && boldFontBase64) {
    return;
  }

  if (fontLoadPromise) {
    return fontLoadPromise;
  }

  fontLoadPromise = (async () => {
    try {
      const [regularRes, boldRes] = await Promise.all([
        fetch('/fonts/Roboto-Regular.ttf'),
        fetch('/fonts/Roboto-Bold.ttf'),
      ]);

      if (!regularRes.ok || !boldRes.ok) {
        throw new Error(`Font fetch error: ${regularRes.status}/${boldRes.status}`);
      }

      const [regularBuf, boldBuf] = await Promise.all([
        regularRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);

      regularFontBase64 = arrayBufferToBase64(regularBuf);
      boldFontBase64 = arrayBufferToBase64(boldBuf);
    } catch (err) {
      console.warn('Could not preload Roboto fonts for jsPDF:', err);
    }
  })();

  return fontLoadPromise;
}

export async function applyVmuFontsToPdf(doc: jsPDF): Promise<boolean> {
  await ensureVmuFontsLoaded();

  if (regularFontBase64) {
    doc.addFileToVFS('Roboto-Regular.ttf', regularFontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  }

  if (boldFontBase64) {
    doc.addFileToVFS('Roboto-Bold.ttf', boldFontBase64);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  }

  if (regularFontBase64 || boldFontBase64) {
    doc.setFont('Roboto', 'normal');
    return true;
  }

  return false;
}
