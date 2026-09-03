# Vaultr Native (v2) ⚡🎬

> Ultra-lightweight, standalone cinema and streaming desktop application powered by **Tauri 2.0** and **Rust**.

[![Rust](https://img.shields.io/badge/Rust-1.77%2B-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue.svg)](https://v2.tauri.app/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Android-green.svg)]()
[![Build](https://img.shields.io/badge/Status-Release%20Ready%20(v1.0.0)-success.svg)]()

---

## ⚡ What is Vaultr Native?

Vaultr is a zero-bloat, standalone native desktop streaming client. Unlike Electron apps that bundle an entire Chromium browser and consume gigabytes of RAM, Vaultr compiles down to a **single ~10MB executable** with near-instant startup and minimal memory footprint.

### 🌟 Key Highlights

- **100% Standalone Executable (`Vaultr.exe`):**
  - Zero external folder dependencies: All UI assets, icons, scripts, and stylesheets are embedded directly into the binary at compile time.
  - Zero runtimes needed: **No Node.js, no npm, no Python, and no dev servers required.**
  - Runs out-of-the-box on modern Windows 10 (21H2+) and Windows 11 using the built-in Microsoft Edge WebView2 runtime.
- **In-Memory Native IPC Architecture:**
  - Operates without any local HTTP server or open loopback ports (`127.0.0.1`), eliminating Windows WebView2 sandbox isolation (`ECONNREFUSED`) issues.
  - Rust backend fetches TMDB metadata securely over TLS 1.3 via `ureq` and transfers data directly into the frontend over Tauri's high-speed memory bridge.
- **Engine-Level Ad & Redirect Shield:**
  - Rust-level navigation interceptor (`on_navigation`) monitors window navigation events.
  - Automatically denies rogue top-level window redirects and ad hijack attempts before they can execute.
- **MovieBox Theater & Media Hub:**
  - Complete catalog discovery, live debounced search, genre filtering, and trending media.
  - Details overlay with YouTube trailer lightbox, cast overview, and multi-season/episode picker.
  - Multi-source stream resolver with instant server switching (VidLink fast stream, VidSrc, AutoEmbed, SuperEmbed).
  - Local persistent watchlist and playback history.

---

## 🚀 Getting Started

### Run the Standalone App (Windows)
1. Download or locate `Vaultr.exe`.
2. Double-click to launch immediately — no installer or setup required.

---

## 🛠️ Building From Source

### Prerequisites
- [Rust & Cargo](https://www.rust-lang.org/tools/install) (1.77+)
- [Node.js](https://nodejs.org/) (v18+, only needed for build tooling)

### 1. Run in Development Mode
```bash
# Clone the repository
git clone https://github.com/katungatigift391-svg/Vaultr-native.git
cd Vaultr-native

# Launch the native development window with hot reload
dev.bat
# or
npx @tauri-apps/cli dev
```

### 2. Compile Standalone Release Binary
```bash
# Clean and compile optimized release binary
npx @tauri-apps/cli build --no-bundle
```
The compiled binary will be generated at:
```
src-tauri/target/release/app.exe  ->  Vaultr.exe
```

---

## 📱 Mobile (Android) Support

Vaultr Native includes built-in scaffolding for Android devices:

```bash
# 1. Initialize Android project files
npx @tauri-apps/cli android init

# 2. Run on connected Android device / emulator
npx @tauri-apps/cli android dev

# 3. Build release APK
npx @tauri-apps/cli android build
```

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
│   ├── Cargo.toml             # Rust manifest (ureq, serde, tauri)
│   └── tauri.conf.json        # Window configuration & asset bundler
├── ui/                        # Embedded Cinema Frontend
│   ├── index.html             # Catalog discovery, trending, search
│   ├── watch.html             # Cinema theater with multi-server switcher
│   ├── css/
│   │   └── main.css           # Premium dark-mode styling & micro-animations
│   └── js/
│       ├── api.js             # Tauri IPC bridge adapter
│       ├── app.js             # Catalog routing & search logic
│       ├── ui.js              # Details modal, season picker, trailer lightbox
│       ├── watch.js           # Theater controller & stream manager
│       └── state.js           # Local bookmarks & preferences
└── dev.bat                    # Quick-start dev launcher
```

---

## 📜 License

Distributed under the [ISC License](LICENSE). Copyright (c) 2026 katungatigift391-svg.
