use url::Url;

const TMDB_API_KEY: &str = "844dba0bfd8f3a4f3799f6130ef9e335";
const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";
const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

#[tauri::command]
fn tmdb_get(endpoint: String, params: Vec<(String, String)>) -> Result<serde_json::Value, String> {
    let agent = ureq::AgentBuilder::new()
        .user_agent(DEFAULT_USER_AGENT)
        .build();

    let full_url = if endpoint.starts_with("http") {
        endpoint
    } else {
        format!("{}{}", TMDB_BASE_URL, endpoint)
    };

    let mut url = Url::parse(&full_url).map_err(|e| format!("URL error: {}", e))?;
    {
        let mut q = url.query_pairs_mut();
        q.append_pair("api_key", TMDB_API_KEY);
        for (k, v) in &params {
            if k == "q" {
                q.append_pair("query", v);
            } else if k == "genre" {
                q.append_pair("with_genres", v);
            } else if k != "api_key" {
                q.append_pair(k, v);
            }
        }
    }

    let resp_str = agent
        .get(url.as_str())
        .call()
        .map_err(|e| format!("TMDB request error: {}", e))?
        .into_string()
        .map_err(|e| format!("Read error: {}", e))?;

    let mut json_val: serde_json::Value = serde_json::from_str(&resp_str)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    if let serde_json::Value::Object(ref mut map) = json_val {
        map.insert("success".to_string(), serde_json::Value::Bool(true));
    }

    Ok(json_val)
}

#[tauri::command]
fn resolve_streams(
    media_type: String,
    id: String,
    season: Option<String>,
    episode: Option<String>,
) -> serde_json::Value {
    let s = season.unwrap_or_else(|| "1".into());
    let e = episode.unwrap_or_else(|| "1".into());
    let is_tv = media_type == "tv";

    let sources = serde_json::json!([
        {
            "name": "VidLink (Fast)",
            "type": "embed",
            "url": if is_tv {
                format!("https://vidlink.pro/tv/{}/{}/{}", id, s, e)
            } else {
                format!("https://vidlink.pro/movie/{}", id)
            },
            "adLevel": "none",
            "quality": "1080p"
        },
        {
            "name": "VidSrc",
            "type": "embed",
            "url": if is_tv {
                format!("https://vidsrc.xyz/embed/tv?tmdb={}&season={}&episode={}", id, s, e)
            } else {
                format!("https://vidsrc.xyz/embed/movie?tmdb={}", id)
            },
            "adLevel": "light",
            "quality": "1080p"
        },
        {
            "name": "AutoEmbed",
            "type": "embed",
            "url": if is_tv {
                format!("https://player.autoembed.cc/embed/tv/{}/{}/{}", id, s, e)
            } else {
                format!("https://player.autoembed.cc/embed/movie/{}", id)
            },
            "adLevel": "light",
            "quality": "1080p"
        },
        {
            "name": "SuperEmbed (Multi)",
            "type": "embed",
            "url": if is_tv {
                format!("https://multiembed.mov/?video_id={}&tmdb=1&s={}&e={}", id, s, e)
            } else {
                format!("https://multiembed.mov/?video_id={}&tmdb=1", id)
            },
            "adLevel": "heavy",
            "quality": "720p"
        }
    ]);

    serde_json::json!({
        "success": true,
        "mediaType": media_type,
        "id": id,
        "sources": sources
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![tmdb_get, resolve_streams])
        .setup(|app| {
            // Construct Main Cinema Window with OS-Level Redirect & Hijack Shield
            #[cfg(desktop)]
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Vaultr — Cinema & Streaming Hub")
            .inner_size(1280.0, 820.0)
            .min_inner_size(960.0, 640.0)
            .center()
            .resizable(true);

            #[cfg(mobile)]
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            );

            let _window = builder
            .on_navigation(|url| {
                let scheme = url.scheme();
                let host = url.host_str().unwrap_or("");

                // Allow internal Tauri protocols and asset loaders
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
