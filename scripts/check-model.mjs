import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const { resolveModelFile } = await import('node-llama-cpp');
const started = Date.now();
let previousBucket = -1;
const modelPath = await resolveModelFile('hf:Qwen/Qwen3-4B-GGUF:Q4_K_M', {
  directory: path.join(root, 'artifacts', 'model-diagnostic', 'models'),
  cli: false,
  onProgress: ({ totalSize, downloadedSize }) => {
    const bucket = Math.floor((totalSize ? downloadedSize / totalSize : 0) * 10);
    if (bucket === previousBucket) return;
    previousBucket = bucket;
    console.log(JSON.stringify({ percent: bucket * 10, downloadedSize, totalSize, seconds: Math.round((Date.now() - started) / 1000) }));
  },
});
console.log(JSON.stringify({ modelPath, seconds: Math.round((Date.now() - started) / 1000) }));
