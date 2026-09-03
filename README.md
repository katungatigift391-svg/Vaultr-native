# Vaultr Native (v2) ⚡🎬

> Ultra-lightweight, standalone cinema and streaming application powered by **Tauri 2.0** and **Rust** for Windows and Android.

[![Rust](https://img.shields.io/badge/Rust-1.77%2B-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue.svg)](https://v2.tauri.app/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Android-green.svg)]()
[![Release](https://img.shields.io/badge/Release-v1.1.0-success.svg)](https://github.com/katungatigift391-svg/Vaultr-native/releases)

---

## ⚡ What is Vaultr Native?

Vaultr is a zero-bloat, high-performance native streaming client built for both desktop (Windows) and mobile (Android). Unlike traditional Electron or bloated wrapper apps that bundle entire Chromium browsers and consume gigabytes of RAM, Vaultr compiles down to a **single ~10.8 MB Windows executable** and a **fast, responsive Android APK** with near-instant startup, native hardware acceleration, and minimal resource usage.

### 🌟 Key Highlights

- **100% Standalone Windows Executable (`Vaultr.exe`):**
  - Zero external folder dependencies: All UI assets, icons, scripts, and stylesheets are embedded directly into the binary at compile time.
  - Zero runtimes needed: **No Node.js, no npm, no Python, and no dev servers required.**
  - Runs out-of-the-box on modern Windows 10 (21H2+) and Windows 11 using the built-in Microsoft Edge WebView2 runtime.
- **Full Android Mobile Support (`Vaultr.apk`):**
  - Native 64-bit ARM (`aarch64`) APK with edge-to-edge rendering.
  - Automatic safe area inset management (`viewport-fit=cover`) preventing collisions with the status bar (battery, clock, notifications) and system navigation buttons.
  - Immersive cinema landscape mode: System bars automatically hide on screen rotation (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`) for a 100% borderless viewing experience.
  - Touch-optimized responsive theater player and episode navigation.
- **In-Memory Native IPC Architecture:**
  - Operates without any local HTTP server or open loopback ports (`127.0.0.1`), eliminating WebView sandbox isolation (`ECONNREFUSED`) issues.
  - Rust backend fetches TMDB metadata securely over TLS 1.3 via `ureq` and transfers data directly into the frontend over Tauri's high-speed memory bridge.
- **Engine-Level Ad & Redirect Shield:**
  - Native Rust navigation interceptor (`on_navigation`) monitors window navigation events and blocks rogue top-level redirects and ad hijacks.
  - Clean stream switching without browser "Changes may not be saved" confirmation prompts.
- **MovieBox Theater & Media Hub:**
  - Complete catalog discovery, live debounced search, genre filtering, and trending media.
  - Details overlay with YouTube trailer lightbox, cast overview, and multi-season/episode picker.
  - Multi-source stream resolver with instant server switching (VidLink fast stream, VidSrc, AutoEmbed, SuperEmbed).
  - Local persistent watchlist and playback history.

---

## 🚀 Download & Installation

Grab the latest pre-compiled binaries from [Releases](https://github.com/katungatigift391-svg/Vaultr-native/releases):

| Platform | Package | Description |
| :--- | :--- | :--- |
| **Windows** | `Vaultr.exe` (~10.8 MB) | Standalone binary. Just double-click and play. |
| **Android** | `Vaultr.apk` (~156 MB) | Universal / ARM64 APK. Sideload onto any modern Android device. |

---

## 🛠️ Building From Source

### Prerequisites
- [Rust & Cargo](https://www.rust-lang.org/tools/install) (1.77+)
- [Node.js](https://nodejs.org/) (v18+, only needed for build tooling)
- [Android SDK & NDK](https://developer.android.com/studio) (for Android compilation)
- [JDK 21 LTS](https://adoptium.net/) (for Android Gradle build)

### 1. Run in Development Mode
```bash
# Clone the repository
git clone https://github.com/katungatigift391-svg/Vaultr-native.git
cd Vaultr-native

# Launch the native desktop window with hot reload
dev.bat
# or
npx @tauri-apps/cli dev
```

### 2. Compile Windows Standalone Binary
```bash
# Build standalone release executable
cargo build --release --manifest-path src-tauri/Cargo.toml
```
The compiled binary will be generated at `src-tauri/target/release/app.exe` (`Vaultr.exe`).

### 3. Compile Android APK
```bash
# Set Android toolchain environment
set JAVA_HOME=C:\Users\<user>\.jdks\jbr-21.0.11
set ANDROID_HOME=C:\Users\<user>\AppData\Local\Android\Sdk
set NDK_HOME=%ANDROID_HOME%\ndk\27.3.13750724

# Build ARM64 release/debug APK
cd src-tauri/gen/android
gradlew.bat assembleArm64Debug
```
The generated APK is located at `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`.

---

## 📁 Repository Architecture

```text
vaultr-native/
├── src-tauri/                 # Native Rust Core (Tauri v2)
│   ├── src/
│   │   ├── main.rs            # Application entrypoint (suppresses console window)
│   │   └── lib.rs             # IPC commands (tmdb_get, resolve_streams) & redirect shield
│   ├── capabilities/          # Tauri v2 security & permission rules
│   ├── icons/                 # Multi-resolution icons (Windows .ico & Android assets)
│   ├── gen/android/           # Android project scaffolding (Kotlin MainActivity & themes)
│   ├── Cargo.toml             # Rust manifest (ureq, serde, tauri)
│   └── tauri.conf.json        # Window configuration & asset bundler
├── ui/                        # Embedded Cinema Frontend
│   ├── index.html             # Catalog discovery, trending, search
│   ├── watch.html             # Cinema theater with multi-server switcher
│   ├── css/
│   │   └── main.css           # Responsive dark-mode styling & safe-area system
│   └── js/
│       ├── api.js             # Tauri IPC bridge adapter
│       ├── app.js             # Catalog routing & search logic
│       ├── ui.js              # Details modal, season picker, trailer lightbox
│       ├── watch.js           # Theater controller & stream manager
│       └── state.js           # Local bookmarks & preferences
└── dev.bat                    # Quick-start desktop dev launcher
```

---

## 📜 License

Distributed under the [ISC License](LICENSE). Copyright (c) 2026 katungatigift391-svg.
