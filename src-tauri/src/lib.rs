#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        let _ = app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        );
      }

      // Construct Main Cinema Window with OS-Level Redirect & Hijack Shield
      let _window = tauri::WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::App("index.html".into()),
      )
      .title("Vaultr — Cinema & Streaming Hub")
      .inner_size(1280.0, 820.0)
      .min_inner_size(960.0, 640.0)
      .center()
      .resizable(true)
      .on_navigation(|url| {
        let scheme = url.scheme();
        let host = url.host_str().unwrap_or("");

        // Allow internal Tauri protocols, asset loaders, and local proxy addresses
        let is_allowed = scheme == "tauri"
          || scheme == "asset"
          || scheme == "ipc"
          || host == "localhost"
          || host == "127.0.0.1"
          || host == "tauri.localhost";

        if !is_allowed {
          log::warn!("[Shield] Blocked rogue top-level redirect hijack: {}", url);
          return false;
        }

        true
      })
      .build()?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
