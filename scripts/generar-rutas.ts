// Regenera docs/RUTAS.md a partir del código (`pnpm rutas`). Un test falla si el archivo y el código divergen.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { readSourceFiles, renderRouteMap } from '../src/server/security/route-audit';

const root = path.resolve(__dirname, '..');
writeFileSync(path.join(root, 'docs/RUTAS.md'), renderRouteMap(readSourceFiles(root)));
console.log('docs/RUTAS.md actualizado');
