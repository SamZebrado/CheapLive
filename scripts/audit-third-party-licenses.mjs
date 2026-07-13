#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const PACKAGE_LOCK = path.join(ROOT, 'package-lock.json');
const LICENSE_FILE = path.join(ROOT, 'LICENSE');
const THIRD_PARTY_NOTICES = path.join(ROOT, 'THIRD_PARTY_NOTICES.md');

const FORBIDDEN_LICENSES = ['GPL-2.0', 'GPL-3.0', 'AGPL', 'SSPL', 'CC-BY-NC', 'CC-BY-NC-SA'];
const ALLOWED_LICENSES = ['MIT', 'ISC', 'BSD', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'LGPL-2.1', '(WTFPL OR MIT)'];
const DEV_ONLY_PACKAGES = new Set(['@playwright/test', 'playwright', 'http-server']);

console.log('=== Third-Party License Audit ===\n');

let errors = [];
let warnings = [];

function checkPackageJson() {
  console.log('1. Checking package.json...');
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  const license = pkg.license;
  
  if (license !== 'MIT') {
    errors.push(`package.json license is "${license}", expected "MIT"`);
  } else {
    console.log('   ✓ package.json license is MIT');
  }
  
  if (!pkg.author || pkg.author.trim() === '') {
    warnings.push('package.json author field is empty');
  }
}

function checkPackageLock() {
  console.log('\n2. Checking package-lock.json...');
  const lock = JSON.parse(fs.readFileSync(PACKAGE_LOCK, 'utf-8'));
  
  if (lock.packages[''].license !== 'MIT') {
    errors.push(`package-lock.json root license is "${lock.packages[''].license}", expected "MIT"`);
  } else {
    console.log('   ✓ package-lock.json root license is MIT');
  }
  
  let unknownLicenses = [];
  let forbiddenLicenses = [];
  let runtimePackages = [];
  
  for (const [key, pkg] of Object.entries(lock.packages)) {
    if (key === '') continue;
    
    const name = pkg.name || key.replace('node_modules/', '');
    const license = pkg.license || 'UNKNOWN';
    const isDev = pkg.dev === true || DEV_ONLY_PACKAGES.has(name);
    
    if (license === 'UNKNOWN') {
      unknownLicenses.push({ name, license, isDev });
    } else if (FORBIDDEN_LICENSES.some(f => license.includes(f))) {
      forbiddenLicenses.push({ name, license, isDev });
    }
    
    if (!isDev) {
      runtimePackages.push({ name, license });
    }
  }
  
  if (unknownLicenses.length > 0) {
    console.log('   ✗ Found packages with UNKNOWN license:');
    for (const { name, license, isDev } of unknownLicenses) {
      const devLabel = isDev ? '(dev-only)' : '(runtime)';
      console.log(`     - ${name}: ${license} ${devLabel}`);
      if (!isDev) {
        errors.push(`Runtime package "${name}" has UNKNOWN license`);
      }
    }
  } else {
    console.log('   ✓ No packages with UNKNOWN license');
  }
  
  if (forbiddenLicenses.length > 0) {
    console.log('   ✗ Found packages with forbidden licenses:');
    for (const { name, license, isDev } of forbiddenLicenses) {
      const devLabel = isDev ? '(dev-only)' : '(runtime)';
      console.log(`     - ${name}: ${license} ${devLabel}`);
      errors.push(`Package "${name}" has forbidden license: ${license}`);
    }
  } else {
    console.log('   ✓ No packages with forbidden licenses');
  }
  
  if (runtimePackages.length > 0) {
    console.log('   Runtime packages:');
    for (const { name, license } of runtimePackages) {
      console.log(`     - ${name}: ${license}`);
    }
  } else {
    console.log('   ✓ No runtime npm packages');
  }
}

function checkLicenseFile() {
  console.log('\n3. Checking LICENSE file...');
  if (fs.existsSync(LICENSE_FILE)) {
    const content = fs.readFileSync(LICENSE_FILE, 'utf-8');
    if (content.includes('MIT License') && content.includes('Copyright')) {
      console.log('   ✓ LICENSE file exists and contains MIT License');
    } else {
      errors.push('LICENSE file does not contain valid MIT License');
    }
  } else {
    errors.push('LICENSE file is missing');
  }
}

function checkThirdPartyNotices() {
  console.log('\n4. Checking THIRD_PARTY_NOTICES.md...');
  if (fs.existsSync(THIRD_PARTY_NOTICES)) {
    const content = fs.readFileSync(THIRD_PARTY_NOTICES, 'utf-8');
    if (content.includes('MediaPipe') && content.includes('SoundTouch')) {
      console.log('   ✓ THIRD_PARTY_NOTICES.md exists and covers major runtime dependencies');
    } else {
      warnings.push('THIRD_PARTY_NOTICES.md may be incomplete');
    }
  } else {
    errors.push('THIRD_PARTY_NOTICES.md is missing');
  }
}

function checkWebAssets() {
  console.log('\n5. Checking Web runtime assets...');
  const srcDir = path.join(ROOT, 'src');
  
  const wasmFiles = [];
  const jsFiles = [];
  
  function scan(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (file.endsWith('.wasm')) {
        wasmFiles.push(fullPath);
      } else if (file.endsWith('.js') && !file.includes('test') && !file.includes('spec')) {
        jsFiles.push(fullPath);
      }
    }
  }
  
  scan(srcDir);
  
  console.log('   WASM files (runtime):');
  for (const file of wasmFiles) {
    const rel = path.relative(ROOT, file);
    console.log(`     - ${rel}`);
  }
  
  console.log('\n   JS files (potential runtime):');
  for (const file of jsFiles.slice(0, 20)) {
    const rel = path.relative(ROOT, file);
    console.log(`     - ${rel}`);
  }
  if (jsFiles.length > 20) {
    console.log(`     ... and ${jsFiles.length - 20} more`);
  }
  
  const mediapipeLicense = path.join(srcDir, 'face-tracking', 'mediapipe', 'LICENSE');
  if (fs.existsSync(mediapipeLicense)) {
    console.log('\n   ✓ MediaPipe LICENSE file exists');
  } else {
    errors.push('MediaPipe LICENSE file is missing');
  }

  // Check SoundTouchJS license file
  const soundtouchLicense = path.join(ROOT, 'third_party', 'soundtouchjs', 'LICENSE');
  if (fs.existsSync(soundtouchLicense)) {
    const stContent = fs.readFileSync(soundtouchLicense, 'utf-8');
    if (stContent.includes('GNU LESSER GENERAL PUBLIC LICENSE') && stContent.includes('Version 2.1')) {
      console.log('   ✓ SoundTouchJS LICENSE file exists (LGPL-2.1)');
    } else {
      errors.push('SoundTouchJS LICENSE file does not contain valid LGPL-2.1 text');
    }
  } else {
    errors.push('SoundTouchJS LICENSE file is missing at third_party/soundtouchjs/LICENSE');
  }

  // Check vendored SoundTouchJS file header for version
  const soundtouchFile = path.join(srcDir, 'face-tracking', 'lib', 'soundtouch.min.js');
  if (fs.existsSync(soundtouchFile)) {
    const stHeader = fs.readFileSync(soundtouchFile, 'utf-8').slice(0, 200);
    if (stHeader.includes('soundtouchjs@0.1.29')) {
      console.log('   ✓ SoundTouchJS vendored file header confirms v0.1.29');
    } else {
      warnings.push('SoundTouchJS vendored file header does not contain expected version');
    }
  }
}

checkPackageJson();
checkPackageLock();
checkLicenseFile();
checkThirdPartyNotices();
checkWebAssets();

console.log('\n=== Audit Summary ===');
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log('\nErrors:');
  for (const error of errors) {
    console.log(`  ✗ ${error}`);
  }
}

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const warning of warnings) {
    console.log(`  ⚠ ${warning}`);
  }
}

if (errors.length === 0) {
  console.log('\n✓ All checks passed!');
  process.exit(0);
} else {
  console.log('\n✗ Audit failed due to errors');
  process.exit(1);
}
