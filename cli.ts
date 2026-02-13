#!/usr/bin/env bun
import { hashLines } from "./index.ts";

const args = process.argv.slice(2);

let input: string;

if (args.length > 0) {
  const path = args[0]!;
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.error(`hashlines: ${path}: No such file`);
    process.exit(1);
  }
  input = await file.text();
} else {
  input = await Bun.stdin.text();
}

console.log(hashLines(input));
