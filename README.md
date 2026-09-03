# Vaultr Native (v2) ⚡🎬

> Modern cross-platform native cinema streaming app for Windows & Android, powered by **Tauri 2.0** and **Rust**.

[![Rust](https://img.shields.io/badge/Rust-1.77%2B-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue.svg)](https://v2.tauri.app/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Android-green.svg)]()

---

## ✨ Features in v2 Native

- **Zero Node / Zero npm on End-User PCs:** Compiles to a self-contained, standalone Windows `.exe` and Android `.apk`.
- **OS-Level Ad & Hijack Interceptor:** Uses native WebView navigation interception (`on_navigation` / `should_override_url_loading`) to deny unauthorized tab redirects and rogue popups before the browser engine can execute them.
- **MovieBox-Style Cinema Experience:**
  - Numbered episode tile grid (`01`, `02`, `03`...) with animated audio visualizer.
  - Multi-audio track switching (Japanese Original vs. English Dub for anime).
  - In-app trailer lightbox via YouTube NoCookie.
  - Netflix-style live debounced search and category exploration chips.
- **Tiny Footprint & Ultra Fast:** Uses the native OS WebView engine (Microsoft Edge WebView2 on Windows, Chromium on Android) for near-instant boot and ultra-low RAM consumption (~15–30MB).

---

## 🛠️ Development & Building

### Prerequisites
1. **Rust & Cargo:** [Install Rust](https://www.rust-lang.org/tools/install) (`rustc >= 1.77`).
2. **Node.js:** For running the Tauri CLI (`npx @tauri-apps/cli`).
3. **Android Studio** *(Optional, for Android APK builds)*: With Android SDK and NDK installed.

---

### Run in Desktop Dev Mode (Windows)
```bash
# Launch the native desktop window with live hot-reloading
npx @tauri-apps/cli dev
```

### Build Production Desktop Installer / Executable
```bash
# Compiles optimized standalone .exe and MSI installer into src-tauri/target/release/
npx @tauri-apps/cli build
```

---

### Android Build (Android Studio & APK)

```bash
# 1. Initialize Android Studio project files
npx @tauri-apps/cli android init

# 2. Run on connected Android device / emulator
npx @tauri-apps/cli android dev

# 3. Build signed or release APK
npx @tauri-apps/cli android build
```
You can also open `src-tauri/gen/android` directly inside **Android Studio** to inspect Gradle builds and export APKs.

---

## 📁 Repository Structure

```text
vaultr-native/
├── src-tauri/                 # Native Rust Core & Tauri v2 Configuration
│   ├── src/
│   │   ├── main.rs            # Desktop application entrypoint
│   │   └── lib.rs             # Tauri lifecycle, IPC & OS security filters
│   ├── capabilities/          # Security capabilities & permission sets
│   ├── icons/                 # Multi-resolution app icons (Windows & Android)
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Window sizes, identifiers, permissions
└── ui/                        # High-Performance Cinema Frontend (Zero External Dependencies)
    ├── index.html             # Catalog discovery, trending, Netflix-style search
    ├── watch.html             # Dedicated cinema theater with MovieBox episode grid
    ├── css/
    │   └── main.css           # Dark-mode design system & animations
    └── js/
        ├── api.js             # Data layer
        ├── watch.js           # Theater controller & multi-audio switcher
        ├── state.js           # Persistent bookmarks & playback memory
        ├── ui.js              # Modals, lightboxes, and cards
        └── app.js             # Catalog routing
```

---

## 📜 License
ISC — Copyright (c) 2026 katungatigift391-svg
