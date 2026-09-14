import zlib from 'zlib';

// Minimal ZIP (central directory) reader for validating Office Open XML
// artifacts (docx/xlsx/pptx) without external dependencies.
// Reads file header methods + names + atomic contents from the central
// directory so we can assert artifact structure and expected text.

export function zipEntries(fileBuffer) {
  const buf = Buffer.from(fileBuffer);
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('not a ZIP file (missing local header)');

  // Locate End Of Central Directory (EOCD).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP missing end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // Local header: read data using local record offset.
    let data = null;
    if (buf.readUInt32LE(localOffset) === 0x04034b50) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) data = raw;
      else if (method === 8) {
        try { data = zlib.inflateRawSync(raw); } catch { data = null; }
      }
    }

    entries.push({
      name,
      method,
      uncompressedSize: uncompSize,
      data,
      text: data ? data.toString('utf8') : null,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}