# Third-Party Notices

This file lists third-party components used in the CheapLive project, along with their licenses and attribution requirements.

## Runtime Web Components

These components are bundled with the web application and distributed to end users.

### MediaPipe Face Landmarker

- **Name**: MediaPipe Tasks Vision (Face Landmarker)
- **Version**: Vendored snapshot (exact npm version not determinable from bundle)
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://github.com/google-ai-edge/mediapipe
- **Purpose**: Real-time face landmark detection for facial capture
- **Distribution**: Bundled with web application (WASM + JS + model)
- **Files**:
  - `src/face-tracking/mediapipe/vision_bundle.mjs`
  - `src/face-tracking/mediapipe/wasm/vision_wasm_internal.wasm` (SHA256: `3431f70071f3980bf13e638551e9bb333335223e35542ee768db06501f7a26f2`)
  - `src/face-tracking/mediapipe/wasm/vision_wasm_internal.js`
  - `src/face-tracking/mediapipe/wasm/vision_wasm_nosimd_internal.wasm`
  - `src/face-tracking/mediapipe/wasm/vision_wasm_nosimd_internal.js`
  - `src/face-tracking/mediapipe/face_landmarker.task`
- **License File**: `src/face-tracking/mediapipe/LICENSE`
- **Attribution**: Copyright 2023 The MediaPipe Authors. Licensed under Apache-2.0.

### MediaPipe Pose Landmarker Lite

- **Name**: MediaPipe Pose Landmarker Lite / BlazePose GHUM 3D
- **Version**: float16/1
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Purpose**: Opt-in local upper-body landmark inference
- **Distribution**: Bundled with the web/Android application; not downloaded at runtime
- **Canonical file**: `src/shared/models/pose_landmarker_lite.task`
- **File size**: 5,777,746 bytes
- **SHA-256**: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`
- **Upstream**: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
- **License File**: `src/face-tracking/mediapipe/LICENSE`
- **Additional inventory**: `MODEL_LICENSES.md`

### SoundTouchJS

- **Name**: SoundTouchJS
- **Version**: 0.1.29 (npm package, exact)
- **License**: LGPL-2.1
- **SPDX**: LGPL-2.1
- **Homepage**: https://github.com/cutterbl/SoundTouchJS
- **Purpose**: Audio pitch shifting for voice effects
- **Distribution**: Bundled with web application (minified)
- **Files**:
  - `src/face-tracking/lib/soundtouch.min.js`
- **File SHA256**: `44509e71d37d75e808261f4eb977c4c5acba3ae6874ec1f3b1c97c90ae5d31ac`
- **Source**: jsDelivr CDN minified from `npm:soundtouchjs@0.1.29/dist/soundtouch.js`
- **License File**: `third_party/soundtouchjs/LICENSE`
- **Copyright**: Copyright (c) Steve 'Cutter' Blades and contributors. Based on SoundTouch by Olli Parviainen.
- **Modifications**: None (vendored as-is from jsDelivr minified output)
- **Note**: This is a copyleft (LGPL-2.1) runtime dependency. The library source is inherently available in web distribution (JavaScript is sent to the browser). The minified file includes the original jsDelivr header identifying the upstream npm package and version.

## Dev-Only Components

These components are used only for development, testing, or build processes and are not distributed to end users.

### Playwright

- **Name**: Playwright
- **Version**: 1.61.0
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://playwright.dev
- **Purpose**: End-to-end testing framework
- **Distribution**: Not bundled with runtime (devDependency)
- **License File**: Included in node_modules/playwright/LICENSE
- **Attribution**: Copyright 2020 Microsoft Corporation. Licensed under Apache-2.0.

### @playwright/test

- **Name**: Playwright Test
- **Version**: 1.61.0
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://playwright.dev
- **Purpose**: Playwright test runner
- **Distribution**: Not bundled with runtime (devDependency)
- **License File**: Included in node_modules/@playwright/test/LICENSE
- **Attribution**: Copyright 2020 Microsoft Corporation. Licensed under Apache-2.0.

### http-server

- **Name**: http-server
- **Version**: 14.1.1
- **License**: MIT
- **SPDX**: MIT
- **Homepage**: https://github.com/http-party/http-server
- **Purpose**: Local development server
- **Distribution**: Not bundled with runtime (devDependency)
- **License File**: Included in node_modules/http-server/LICENSE
- **Attribution**: Copyright (c) 2012-2022 Charlie Robbins, Mikeal Rogers, and other contributors. Licensed under MIT.

## Runtime Android Components

These components are bundled with the Android APK and distributed to end users.

### AndroidX Core

- **Name**: androidx.core:core-ktx
- **Version**: 1.12.0
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://developer.android.com/jetpack/androidx/core
- **Purpose**: Core Android utilities
- **Distribution**: Bundled with APK

### AndroidX AppCompat

- **Name**: androidx.appcompat:appcompat
- **Version**: 1.6.1
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://developer.android.com/jetpack/androidx/releases/appcompat
- **Purpose**: Backward compatibility for Android UI
- **Distribution**: Bundled with APK

### Material Design Components

- **Name**: com.google.android.material:material
- **Version**: 1.11.0
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://material.io/develop/android
- **Purpose**: Material Design UI components
- **Distribution**: Bundled with APK

### AndroidX ConstraintLayout

- **Name**: androidx.constraintlayout:constraintlayout
- **Version**: 2.1.4
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://developer.android.com/jetpack/androidx/releases/constraintlayout
- **Purpose**: Flexible layout manager
- **Distribution**: Bundled with APK

### AndroidX WebKit

- **Name**: androidx.webkit:webkit
- **Version**: 1.4.0
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://developer.android.com/jetpack/androidx/releases/webkit
- **Purpose**: WebView support utilities
- **Distribution**: Bundled with APK

### ZXing Core

- **Name**: com.google.zxing:core
- **Version**: 3.5.2
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://github.com/zxing/zxing
- **Purpose**: Barcode/QR code scanning
- **Distribution**: Bundled with APK

### ZXing Android Embedded

- **Name**: com.journeyapps:zxing-android-embedded
- **Version**: 4.3.0
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://github.com/journeyapps/zxing-android-embedded
- **Purpose**: Android barcode scanning integration
- **Distribution**: Bundled with APK

## Project Original Code

All code not explicitly listed above is original work by SamZebrado and is licensed under the MIT License (see LICENSE file).

## License Summary

| License | Count | Components | Risk Level |
|---------|-------|------------|------------|
| MIT | 2 | http-server, Project original code | Low |
| Apache-2.0 | 12 | MediaPipe, Playwright, @playwright/test, AndroidX (5), Material, ZXing (2) | Low |
| LGPL-2.1 | 1 | SoundTouchJS | Medium (copyleft) |

### Copyleft Notice

SoundTouchJS (LGPL-2.1) is a copyleft runtime dependency. For web distribution, the JavaScript source is inherently available to end users (sent to browser), satisfying LGPL source availability requirements. The original license text is included at `third_party/soundtouchjs/LICENSE`.

No GPL, AGPL, SSPL, or non-commercial licenses are used in this project.
