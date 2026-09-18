/**
 * The pixel dimensions of a PNG or JPEG, read out of the file's own bytes (§6.94).
 *
 * Needed because a logo has to be placed at a fixed HEIGHT with its width derived, or a wordmark and a
 * roundel come out as wildly different weights of mark on the same cover. Word needs both numbers up front
 * — it does not work them out — so somebody has to read them, and the only trustworthy source is the file.
 *
 * No dependency for this. A PNG carries width and height as two big-endian 32-bit integers at a fixed offset
 * in its first chunk; a JPEG carries them in whichever SOF marker it happens to use, which has to be walked
 * for. Both are a few lines, and both return null rather than guessing when the file is not what it claims
 * — a caller that gets null falls back to a sane ratio rather than producing a stretched logo.
 */
export type ImageShape = { width: number; height: number };

/** PNG: 8-byte signature, then the IHDR chunk, whose data begins at byte 16 with width then height. */
function pngSize(b: Buffer): ImageShape | null {
  if (b.length < 24) return null;
  if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (b.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * JPEG: a chain of markers. Walk them until a start-of-frame, which carries height then width. SOF0/1/2/…
 * are 0xC0–0xCF except 0xC4 (Huffman table), 0xC8 (reserved) and 0xCC (arithmetic coding conditioning) —
 * those three are not frames and skipping that detail is how this kind of reader returns a garbage size.
 */
function jpegSize(b: Buffer): ImageShape | null {
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return null;
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) { at++; continue; }
    const marker = b[at + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    const length = b.readUInt16BE(at + 2);
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      const height = b.readUInt16BE(at + 5), width = b.readUInt16BE(at + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    at += 2 + length;
  }
  return null;
}

/** Whichever the bytes actually are, regardless of what the upload called them. */
export function imageSize(image: { data: Buffer; type: "png" | "jpg" }): ImageShape | null {
  return pngSize(image.data) ?? jpegSize(image.data);
}
