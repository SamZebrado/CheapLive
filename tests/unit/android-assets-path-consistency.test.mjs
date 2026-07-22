import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_ROOT = path.join(__dirname, '..', '..', 'android-capture', 'app', 'src', 'main', 'assets', 'web');

function localServerResolve(urlPath) {
    let p = urlPath.split('?')[0];
    if (p === '/capture' || p === '/capture/' || p === '/capture/index.html') {
        return 'web/capture/index.html';
    }
    if (p.startsWith('/capture/')) {
        return 'web/capture/' + p.slice('/capture/'.length);
    }
    if (p === '/receiver' || p === '/receiver/' || p === '/receiver/index.html') {
        return 'web/receiver/index.html';
    }
    if (p.startsWith('/receiver/')) {
        return 'web/receiver/' + p.slice('/receiver/'.length);
    }
    if (p === '/control' || p === '/control/' || p === '/control/index.html') {
        return 'web/control/index.html';
    }
    if (p.startsWith('/control/')) {
        return 'web/control/' + p.slice('/control/'.length);
    }
    if (p === '/black-screen' || p === '/black-screen/' || p === '/black-screen/index.html') {
        return 'web/black-screen/index.html';
    }
    if (p.startsWith('/black-screen/')) {
        return 'web/black-screen/' + p.slice('/black-screen/'.length);
    }
    if (p === '/demo' || p === '/demo/' || p === '/demo/demo.html') {
        return 'web/demo/demo.html';
    }
    if (p.startsWith('/demo/')) {
        return 'web/demo/' + p.slice('/demo/'.length);
    }
    if (p.startsWith('/assets/')) {
        return 'web/receiver/' + p.slice('/assets/'.length);
    }
    if (p.startsWith('/web/')) {
        return 'web/' + p.slice('/web/'.length);
    }
    if (p === '/min-audio-send' || p === '/min-audio-send/') {
        return 'web/min-audio-send.html';
    }
    if (p === '/min-audio-receiver' || p === '/min-audio-receiver/') {
        return 'web/min-audio-receiver.html';
    }
    return null;
}

function fileExists(assetRelPath) {
    const assetsDir = path.join(ASSETS_ROOT, '..');
    const fullPath = path.join(assetsDir, assetRelPath);
    const normalized = path.normalize(fullPath);
    try {
        return fs.existsSync(normalized) && fs.statSync(normalized).isFile();
    } catch (e) {
        return false;
    }
}

function extractImports(htmlContent) {
    const imports = [];
    const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(htmlContent)) !== null) {
        imports.push(match[1]);
    }
    const srcRegex = /<script[^>]+src=['"]([^'"]+)['"]/g;
    while ((match = srcRegex.exec(htmlContent)) !== null) {
        imports.push(match[1]);
    }
    const hrefRegex = /<link[^>]+href=['"]([^'"]+)['"]/g;
    while ((match = hrefRegex.exec(htmlContent)) !== null) {
        imports.push(match[1]);
    }
    return imports;
}

describe('Android Asset Path Consistency', function() {
    it('capture/index.html imports resolve to existing files', function() {
        const captureHtmlPath = path.join(ASSETS_ROOT, 'capture', 'index.html');
        const html = fs.readFileSync(captureHtmlPath, 'utf8');
        const imports = extractImports(html);
        
        const failures = [];
        for (const imp of imports) {
            if (imp.startsWith('http://') || imp.startsWith('https://') || imp.startsWith('//')) {
                continue;
            }
            const resolved = localServerResolve(imp);
            if (resolved === null) {
                failures.push(`No route for: ${imp}`);
                continue;
            }
            if (!fileExists(resolved)) {
                failures.push(`File not found for ${imp} (resolved to ${resolved})`);
            }
        }
        
        assert.deepStrictEqual(failures, [], `Some imports don't resolve to existing files`);
    });

    it('LocalServer /capture/sphere.js returns 200', function() {
        const resolved = localServerResolve('/capture/sphere.js');
        assert.strictEqual(resolved, 'web/capture/sphere.js');
        assert.ok(fileExists(resolved), 'sphere.js should exist at web/capture/sphere.js');
    });

    it('old broken path /assets/web/capture/sphere.js does NOT resolve correctly', function() {
        const resolved = localServerResolve('/assets/web/capture/sphere.js');
        assert.strictEqual(resolved, 'web/receiver/web/capture/sphere.js');
        assert.ok(!fileExists(resolved), 
            'This path should NOT exist - it was the root cause of the camera regression bug');
    });
});
