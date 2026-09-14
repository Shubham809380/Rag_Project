import 'dotenv/config';
import fs from 'fs';
import { getLocalProvider } from './backend/providers/index.js';
import { modelRouter } from './backend/models/router.js';
import { modelRegistry } from './backend/models/registry.js';
modelRegistry.clearFailures('vision_local');
const prov = getLocalProvider();
const bytes = fs.readFileSync('datasets/pump-p101-scanned-tag.png');
const imageData = 'data:image/png;base64,' + bytes.toString('base64');
const r = await modelRouter().generate({ question: 'Describe this image briefly.', taskType: 'vision', images: [imageData], temperature: 0.1 });
console.log('generate ok=', r.ok);
if (!r.ok) { console.log('message=', r.message); console.log('error=', r.error?.message, r.error?.stack?.split('\n').slice(0,3).join('\n')); process.exit(0); }
console.log('content=', r.content.slice(0, 400));
