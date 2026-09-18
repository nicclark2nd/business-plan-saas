import { describe, expect, it } from "vitest";
import { imageSize } from "./imageSize";

/**
 * Dimensions read out of the bytes (§6.94), because a logo is placed at a fixed height with its width
 * derived — and a wrong ratio is a stretched logo on the cover of a document going to a bank.
 *
 * The fixtures are built here, byte by byte, rather than loaded from a file: the test then states what a
 * PNG and a JPEG ACTUALLY ARE, instead of agreeing with whatever some sample file happens to contain
 * (§6.92.1).
 */
const png = (w: number, h: number) => {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8); b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
};

/** SOI, one APP0 segment to be skipped, then an SOF0 carrying height then width. */
const jpeg = (w: number, h: number, marker = 0xc0) => {
  const b = Buffer.alloc(24);
  let at = 0;
  b.writeUInt16BE(0xffd8, at); at += 2;
  b.writeUInt16BE(0xffe0, at); at += 2; b.writeUInt16BE(6, at); at += 2; b.write("JFIF", at, "ascii"); at += 4;
  b.writeUInt16BE(0xff00 | marker, at); at += 2;
  b.writeUInt16BE(11, at); at += 2;
  b[at] = 8; at += 1;
  b.writeUInt16BE(h, at); at += 2;
  b.writeUInt16BE(w, at);
  return b;
};

describe("image dimensions", () => {
  it("reads a PNG", () => {
    expect(imageSize({ data: png(640, 160), type: "png" })).toEqual({ width: 640, height: 160 });
  });

  it("reads a JPEG, walking past the segments before the frame", () => {
    expect(imageSize({ data: jpeg(1200, 400), type: "jpg" })).toEqual({ width: 1200, height: 400 });
  });

  it("reads a progressive JPEG too — SOF2 is a frame, not a table", () => {
    expect(imageSize({ data: jpeg(300, 300, 0xc2), type: "jpg" })).toEqual({ width: 300, height: 300 });
  });

  /**
   * 0xC4 is a Huffman table, not a frame. Treating it as one reads two length bytes as a size and produces
   * a logo of some arbitrary shape — the exact failure this reader exists to avoid.
   */
  it("does not mistake a Huffman table for a frame", () => {
    expect(imageSize({ data: jpeg(300, 300, 0xc4), type: "jpg" })).toBeNull();
  });

  it("reads whatever the bytes really are, whatever the upload called them", () => {
    expect(imageSize({ data: png(100, 50), type: "jpg" })).toEqual({ width: 100, height: 50 });
  });

  it("returns null rather than guessing", () => {
    expect(imageSize({ data: Buffer.alloc(4), type: "png" })).toBeNull();
    expect(imageSize({ data: Buffer.from("not an image at all, truly"), type: "png" })).toBeNull();
    expect(imageSize({ data: png(0, 0), type: "png" })).toBeNull();
  });
});
