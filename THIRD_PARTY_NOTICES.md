# Third-Party Notices

This file lists third-party components used in the CheapLive project, along with their licenses and attribution requirements.

## Runtime Web Components

These components are bundled with the web application and distributed to end users.

### MediaPipe Face Landmarker

- **Name**: MediaPipe Tasks Vision (Face Landmarker)
- **Version**: 0.10.x (approximate, based on vision_bundle.mjs)
- **License**: Apache-2.0
- **SPDX**: Apache-2.0
- **Homepage**: https://github.com/google-ai-edge/mediapipe
- **Purpose**: Real-time face landmark detection for facial capture
- **Distribution**: Bundled with web application (WASM + JS + model)
- **Files**:
  - `src/face-tracking/mediapipe/vision_bundle.mjs`
  - `src/face-tracking/mediapipe/wasm/vision_wasm_internal.wasm`
  - `src/face-tracking/mediapipe/wasm/vision_wasm_internal.js`
  - `src/face-tracking/mediapipe/wasm/vision_wasm_nosimd_internal.wasm`
  - `src/face-tracking/mediapipe/wasm/vision_wasm_nosimd_internal.js`
  - `src/face-tracking/mediapipe/face_landmarker.task`
- **License File**: `src/face-tracking/mediapipe/LICENSE`
- **Attribution**: Copyright 2023 The MediaPipe Authors. Licensed under Apache-2.0.

### SoundTouchJS

- **Name**: SoundTouchJS
- **Version**: 0.1.29
- **License**: MIT
- **SPDX**: MIT
- **Homepage**: https://github.com/cotejp/soundtouchjs
- **Purpose**: Audio pitch shifting for voice effects
- **Distribution**: Bundled with web application (minified)
- **Files**:
  - `src/face-tracking/lib/soundtouch.min.js`
- **License File**: Not included (original license: MIT)
- **Attribution**: Copyright (c) 2014-2020 cotejp and contributors. Licensed under MIT.

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

| License | Count | Risk Level |
|---------|-------|------------|
| MIT | 3 | Low |
| Apache-2.0 | 10 | Low |

No GPL, AGPL, SSPL, or non-commercial licenses are used in this project.
