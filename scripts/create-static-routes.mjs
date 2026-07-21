import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const adminDirectory = resolve("dist/admin");
await mkdir(adminDirectory, { recursive: true });
await copyFile(resolve("dist/index.html"), resolve(adminDirectory, "index.html"));
