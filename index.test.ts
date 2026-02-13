import { describe, expect, it } from 'bun:test';
import { lineHash, hashLines, parseAnchor } from '.';

// ---------------------------------------------------------------------------
// lineHash
// ---------------------------------------------------------------------------
describe('lineHash', () => {
  it('returns a number in the 12-bit range [0, 0xFFF]', () => {
    const inputs = ['', 'a', 'hello world', '  ', '\t', '0', 'abc'.repeat(1000)];
    for (const input of inputs) {
      const h = lineHash(input);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xFFF);
    }
  });

  it('is deterministic (same input → same output)', () => {
    expect(lineHash('hello')).toBe(lineHash('hello'));
    expect(lineHash('')).toBe(lineHash(''));
  });

  it('returns 0xdc5 for an empty string (FNV offset basis masked)', () => {
    // FNV-1a offset basis is 0x811c9dc5; no bytes processed → h & 0xFFF = 0xdc5
    expect(lineHash('')).toBe(0xdc5);
  });

  it('produces different hashes for different single characters', () => {
    const hashes = new Set(['a', 'b', 'c', 'A', '1', ' '].map(lineHash));
    // While collisions are theoretically possible in 12 bits,
    // these common characters should not collide.
    expect(hashes.size).toBe(6);
  });

  it('handles multi-byte UTF-8 characters', () => {
    // Emoji is multi-byte in UTF-8; should not throw
    const h = lineHash('🔥');
    expect(typeof h).toBe('number');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xFFF);
  });

  it('distinguishes lines that differ only by trailing whitespace', () => {
    expect(lineHash('foo')).not.toBe(lineHash('foo '));
    expect(lineHash('foo')).not.toBe(lineHash('foo\t'));
  });

  it('matches known reference values from the golden test', () => {
    // Taken from the hashLines output of index.ts itself
    expect(lineHash('export function lineHash(line: string): Number {')).toBe(0x333);
    expect(lineHash('}')).toBe(0x8a8);
    expect(lineHash('  }')).toBe(0xfd0);
  });
});

// ---------------------------------------------------------------------------
// hashLines
// ---------------------------------------------------------------------------
describe('hashLines', () => {
  it('golden test: hashes its own source file correctly', async () => {
    const content = await Bun.file('index.ts').text();
    const compare = `1:333|export function lineHash(line: string): Number {
2:296|  const bytes = new TextEncoder().encode(line);
3:05a|  let h = 0x811c9dc5;
4:899|  for (const b of bytes) {
5:533|    h ^= b;
6:161|    h = Math.imul(h, 0x01000193) >>> 0;
7:fd0|  }
8:25d|  return (h & 0xFFF);
9:8a8|}
10:dc5|
11:78f|export function hashLines(str: string): string {
12:a28|  return str.trim().split(/\\r?\\n/).map((l, i) => \`\${i+1}:\${lineHash(l).toString(16).padStart(3, '0')}|\${l}\`).join('\\n');
13:8a8|}
14:dc5|
15:47d|export function parseAnchor(str: string): [number, number] {
16:4c6|  const [lineStr, hashStr] = str.split(':', 2);
17:dc5|
18:a5a|  if (!lineStr || !hashStr) {
19:ef8|    throw Error(\`Invalid input sequence '\${str}'\`);
20:fd0|  }
21:dc5|
22:f2f|  const line = parseInt(lineStr.trim());
23:515|  if (line === 0) {
24:77a|    return [-1, -1];
25:fd0|  }
26:dc5|
27:28b|  let hash = parseInt(hashStr, 16);
28:dc5|
29:800|  return [line, hash];
30:8a8|}`;
    expect(hashLines(content)).toEqual(compare);
  });

  it('formats a single line correctly', () => {
    const result = hashLines('hello');
    // Format: "1:<3-hex-chars>|hello"
    expect(result).toMatch(/^1:[0-9a-f]{3}\|hello$/);
  });

  it('numbers lines starting at 1', () => {
    const result = hashLines('a\nb\nc');
    const lines = result.split('\n');
    expect(lines[0]).toMatch(/^1:/);
    expect(lines[1]).toMatch(/^2:/);
    expect(lines[2]).toMatch(/^3:/);
  });

  it('pads hex hashes to 3 characters', () => {
    // All hashes should be exactly 3 hex digits (zero-padded)
    const result = hashLines('a\nb\nc\nd\ne');
    for (const line of result.split('\n')) {
      const match = line.match(/^\d+:([0-9a-f]{3})\|/);
      expect(match).not.toBeNull();
    }
  });

  it('trims leading and trailing whitespace from the input', () => {
    const result1 = hashLines('  hello  ');
    // After trim, input is "hello" (single line)
    expect(result1).toMatch(/^1:[0-9a-f]{3}\|hello$/);
  });

  it('handles Windows-style \\r\\n line endings', () => {
    const result = hashLines('a\r\nb\r\nc');
    const lines = result.split('\n');
    expect(lines).toHaveLength(3);
    // Lines should not contain \r
    for (const line of lines) {
      expect(line).not.toContain('\r');
    }
  });

  it('handles an empty line in the middle', () => {
    const result = hashLines('a\n\nb');
    const lines = result.split('\n');
    expect(lines).toHaveLength(3);
    // Middle line is empty, so hash should be the empty-string hash (dc5)
    expect(lines[1]).toMatch(/^2:dc5\|$/);
  });

  it('handles input that is just whitespace (trims to empty string)', () => {
    const result = hashLines('   ');
    // trim() → "", split → [""], one line with empty content
    expect(result).toBe('1:dc5|');
  });

  it('preserves pipe characters within line content', () => {
    const result = hashLines('a|b');
    // Should be: 1:<hash>|a|b
    expect(result).toMatch(/^1:[0-9a-f]{3}\|a\|b$/);
  });

  it('preserves colon characters within line content', () => {
    const result = hashLines('key: value');
    expect(result).toMatch(/^1:[0-9a-f]{3}\|key: value$/);
  });
});

// ---------------------------------------------------------------------------
// parseAnchor
// ---------------------------------------------------------------------------
describe('parseAnchor', () => {
  it('parses a valid anchor like "5:abc" into [5, 0xabc]', () => {
    expect(parseAnchor('5:abc')).toEqual([5, 0xabc]);
  });

  it('parses line 0 as [-1, -1]', () => {
    expect(parseAnchor('0:000')).toEqual([-1, -1]);
  });

  it('handles leading whitespace in the line number', () => {
    expect(parseAnchor(' 3:fff')).toEqual([3, 0xfff]);
  });

  it('parses hex hash correctly (e.g., "10:0ff" → [10, 255])', () => {
    expect(parseAnchor('10:0ff')).toEqual([10, 255]);
  });

  it('handles anchors with large line numbers', () => {
    expect(parseAnchor('9999:abc')).toEqual([9999, 0xabc]);
  });

  it('throws on completely empty string', () => {
    expect(() => parseAnchor('')).toThrow('Invalid input sequence');
  });

  it('throws on string with no colon', () => {
    expect(() => parseAnchor('hello')).toThrow('Invalid input sequence');
  });

  it('throws on string with only a colon', () => {
    expect(() => parseAnchor(':')).toThrow('Invalid input sequence');
  });
});
