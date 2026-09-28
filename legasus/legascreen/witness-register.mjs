// --import entry. Registers the loader before anything the run imports, which is the only moment at
// which an existing test can still be witnessed.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const cfg = JSON.parse(process.env.LGS_WITNESS_CONFIG || '{"targets":[]}');
cfg.storeUrl = new URL('./witness-store.mjs', import.meta.url).href;
void pathToFileURL;

register('./witness-loader.mjs', import.meta.url, { data: cfg });
