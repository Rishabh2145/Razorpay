
import fs from "fs"
import path from "path"

const source = path.join(
  process.cwd(),
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm"
);

const destination = path.join(
  process.cwd(),
  "public",
  "mediapipe"
);

fs.mkdirSync(destination, { recursive: true });

for (const file of fs.readdirSync(source)) {
  const sourceFile = path.join(source, file);
  const destinationFile = path.join(destination, file);

  fs.copyFileSync(sourceFile, destinationFile);
}

console.log("MediaPipe WASM files copied successfully.");