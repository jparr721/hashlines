export function lineHash(line: string): Number {
  const bytes = new TextEncoder().encode(line);
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h & 0xFFF);
}

export function hashLines(str: string): string {
  return str.trim().split(/\r?\n/).map((l, i) => `${i+1}:${lineHash(l).toString(16).padStart(3, '0')}|${l}`).join('\n');
}

export function parseAnchor(str: string): [number, number] {
  const [lineStr, hashStr] = str.split(':', 2);

  if (!lineStr || !hashStr) {
    throw Error(`Invalid input sequence '${str}'`);
  }

  const line = parseInt(lineStr.trim());
  if (line === 0) {
    return [-1, -1];
  }

  let hash = parseInt(hashStr, 16);

  return [line, hash];
}
