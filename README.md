# hashlines

Annotates each line of text with a line number and a short FNV-1a hash, used based on Can Boluk's [implementation](https://blog.can.ac/2026/02/12/the-harness-problem/)

## Install

```sh
bun install hashlines
```

## CLI

```sh
# from a file
hashlines index.ts

# from stdin
cat index.ts | hashlines
```

Output looks like:

```
1:333|export function lineHash(line: string): Number {
2:296|  const bytes = new TextEncoder().encode(line);
3:05a|  let h = 0x811c9dc5;
```

Each line is formatted as `<line>:<hash>|<content>` where `<hash>` is a 3-digit hex FNV-1a hash of the line content.

## Library

```ts
import { lineHash, hashLines, parseAnchor } from "hashlines";

// hash a single line (returns a 12-bit number)
lineHash("hello world"); // 4007

// annotate all lines in a string
hashLines("foo\nbar\nbaz");
// "1:915|foo\n2:89f|bar\n3:e40|baz"

// parse a "line:hash" anchor back into [lineNumber, hash]
parseAnchor("5:abc"); // [5, 2748]
```
