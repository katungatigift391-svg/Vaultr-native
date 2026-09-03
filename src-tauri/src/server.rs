use std::io::Cursor;
use std::sync::Arc;
use std::thread;
use tiny_http::{Header, Method, Response, Server, StatusCode};
use url::Url;

const TMDB_API_KEY: &str = "844dba0bfd8f3a4f3799f6130ef9e335";
const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";
const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

pub fn start() {
    thread::spawn(|| {
        let server = match Server::http("127.0.0.1:3000") {
            Ok(s) => s,
            Err(e) => {
                log::error!("[Native Server] Failed to bind to 127.0.0.1:3000: {}", e);
                return;
            }
        };

        log::info!("[Native Server] Vaultr Native backend running on http://127.0.0.1:3000");

        let client = Arc::new(
            reqwest::blocking::Client::builder()
                .user_agent(DEFAULT_USER_AGENT)
                .build()
                .unwrap(),
        );

        for request in server.incoming_requests() {
            let client = Arc::clone(&client);
            thread::spawn(move || {
                handle_request(request, client);
            });
        }
    });
}

fn cors_headers() -> Vec<Header> {
    vec![
        Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
        Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..]).unwrap(),
        Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"*"[..]).unwrap(),
    ]
}

fn json_response(json_str: String, status: u16) -> Response<Cursor<Vec<u8>>> {
    let mut resp = Response::from_string(json_str);
    resp = resp.with_status_code(StatusCode(status));
    resp.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json; charset=utf-8"[..]).unwrap());
    for h in cors_headers() {
        resp.add_header(h);
    }
    resp
}

fn handle_request(request: tiny_http::Request, client: Arc<reqwest::blocking::Client>) {
    let method = request.method().clone();
    let url_raw = request.url().to_string();

    if method == Method::Options {
        let mut resp = Response::empty(204);
        for h in cors_headers() {
            resp.add_header(h);
        }
        let _ = request.respond(resp);
        return;
    }

    let parsed_url = match Url::parse(&format!("http://127.0.0.1:3000{}", url_raw)) {
        Ok(u) => u,
        Err(_) => {
            let _ = request.respond(json_response(r#"{"error":"Invalid URL"}"#.into(), 400));
            return;
        }
    };

    let path = parsed_url.path().to_string();

    // 1. Health Check
    if path == "/api/health" {
        let _ = request.respond(json_response(r#"{"status":"online","platform":"Vaultr Native"}"#.into(), 200));
        return;
    }

    // 2. TMDB API Proxy
    if path.starts_with("/api/tmdb/") {
        handle_tmdb(request, &parsed_url, &client);
        return;
    }

    // 3. Stream Resolver
    if path == "/api/stream/resolve" {
        handle_stream_resolve(request, &parsed_url);
        return;
    }

    // 4. HLS Proxy
    if path == "/api/proxy/hls" {
        handle_hls_proxy(request, &parsed_url, &client);
        return;
    }

    // 5. Binary Segment Proxy
    if path == "/api/proxy/segment" {
        handle_segment_proxy(request, &parsed_url, &client);
        return;
    }

    let _ = request.respond(json_response(r#"{"error":"Endpoint not found"}"#.into(), 404));
}

fn handle_tmdb(request: tiny_http::Request, url: &Url, client: &reqwest::blocking::Client) {
    let path = url.path();
    let query_pairs: Vec<(String, String)> = url.query_pairs().into_owned().collect();

    let tmdb_endpoint = if path.starts_with("/api/tmdb/trending/") {
        let parts: Vec<&str> = path.trim_start_matches("/api/tmdb/trending/").split('/').collect();
        let media_type = parts.first().unwrap_or(&"all");
        let time_window = parts.get(1).unwrap_or(&"week");
        format!("{}/trending/{}/{}", TMDB_BASE_URL, media_type, time_window)
    } else if path.starts_with("/api/tmdb/discover/") {
        let media_type = path.trim_start_matches("/api/tmdb/discover/");
        format!("{}/discover/{}", TMDB_BASE_URL, media_type)
    } else if path == "/api/tmdb/search" {
        format!("{}/search/multi", TMDB_BASE_URL)
    } else if path.starts_with("/api/tmdb/details/") {
        let parts: Vec<&str> = path.trim_start_matches("/api/tmdb/details/").split('/').collect();
        let media_type = parts.first().unwrap_or(&"movie");
        let id = parts.get(1).unwrap_or(&"");
        format!("{}/{}/{}?append_to_response=videos,credits,similar,recommendations", TMDB_BASE_URL, media_type, id)
    } else if path.starts_with("/api/tmdb/tv/") && path.contains("/season/") {
        let clean = path.trim_start_matches("/api/tmdb/tv/");
        let parts: Vec<&str> = clean.split("/season/").collect();
        let id = parts.first().unwrap_or(&"");
        let season = parts.get(1).unwrap_or(&"1");
        format!("{}/tv/{}/season/{}", TMDB_BASE_URL, id, season)
    } else if path == "/api/tmdb/genres" {
        // Fetch movie genres by default
        format!("{}/genre/movie/list", TMDB_BASE_URL)
    } else {
        let _ = request.respond(json_response(r#"{"error":"Invalid TMDB route"}"#.into(), 400));
        return;
    };

    let mut upstream_url = match Url::parse(&tmdb_endpoint) {
        Ok(u) => u,
        Err(_) => {
            let _ = request.respond(json_response(r#"{"error":"Upstream URL error"}"#.into(), 500));
            return;
        }
    };

    {
        let mut query = upstream_url.query_pairs_mut();
        query.append_pair("api_key", TMDB_API_KEY);
        for (k, v) in query_pairs {
            if k == "q" {
                query.append_pair("query", &v);
            } else if k == "genre" {
                query.append_pair("with_genres", &v);
            } else {
                query.append_pair(&k, &v);
            }
        }
    }

    match client.get(upstream_url.as_str()).send() {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let raw = resp.text().unwrap_or_else(|_| "{}".into());

            // Inject success:true into the TMDB JSON body directly so frontend
            // can access .results, .genres etc at the top level as before.
            let final_body = if raw.trim_start().starts_with('{') {
                // Insert "success":true as first field
                format!("{{\"success\":true,{}", &raw.trim_start()[1..])
            } else {
                format!("{{\"success\":true,\"data\":{}}}", raw)
            };

            let _ = request.respond(json_response(final_body, status));
        }
        Err(e) => {
            let _ = request.respond(json_response(format!(r#"{{"success":false,"error":"{}"}}"#, e), 502));
        }
    }
}

fn handle_stream_resolve(request: tiny_http::Request, url: &Url) {
    let mut media_type = "movie".to_string();
    let mut id = "".to_string();
    let mut season = "1".to_string();
    let mut episode = "1".to_string();

    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "type" => media_type = v.to_string(),
            "id" => id = v.to_string(),
            "season" => season = v.to_string(),
            "episode" => episode = v.to_string(),
            _ => {}
        }
    }

    let is_tv = media_type == "tv";

    let sources = serde_json::json!([
        {
            "name": "VidLink (Fast)",
            "type": "embed",
            "url": if is_tv {
                format!("https://vidlink.pro/tv/{}/{}/{}", id, season, episode)
            } else {
                format!("https://vidlink.pro/movie/{}", id)
            },
            "adLevel": "none",
            "quality": "1080p",
            "requiresSandbox": false
        },
        {
            "name": "VidSrc",
            "type": "embed",
            "url": if is_tv {
                format!("https://vidsrc.xyz/embed/tv?tmdb={}&season={}&episode={}", id, season, episode)
            } else {
                format!("https://vidsrc.xyz/embed/movie?tmdb={}", id)
            },
            "adLevel": "light",
            "quality": "1080p",
            "requiresSandbox": false
        },
        {
            "name": "AutoEmbed",
            "type": "embed",
            "url": if is_tv {
                format!("https://player.autoembed.cc/embed/tv/{}/{}/{}", id, season, episode)
            } else {
                format!("https://player.autoembed.cc/embed/movie/{}", id)
            },
            "adLevel": "light",
            "quality": "1080p",
            "requiresSandbox": false
        },
        {
            "name": "SuperEmbed (Multi)",
            "type": "embed",
            "url": if is_tv {
                format!("https://multiembed.mov/?video_id={}&tmdb=1&s={}&e={}", id, season, episode)
            } else {
                format!("https://multiembed.mov/?video_id={}&tmdb=1", id)
            },
            "adLevel": "heavy",
            "quality": "720p",
            "requiresSandbox": false
        }
    ]);

    let response_body = serde_json::json!({
        "success": true,
        "mediaType": media_type,
        "id": id,
        "sources": sources
    });

    let _ = request.respond(json_response(response_body.to_string(), 200));
}

fn handle_hls_proxy(request: tiny_http::Request, url: &Url, client: &reqwest::blocking::Client) {
    let mut target_url = String::new();
    let mut referer = String::new();

    for (k, v) in url.query_pairs() {
        if k == "url" {
            target_url = v.to_string();
        } else if k == "referer" {
            referer = v.to_string();
        }
    }

    if target_url.is_empty() {
        let _ = request.respond(json_response(r#"{"error":"Missing url parameter"}"#.into(), 400));
        return;
    }

    let mut req_builder = client.get(&target_url);
    if !referer.is_empty() {
        req_builder = req_builder.header("Referer", referer.clone());
        if let Ok(ref_url) = Url::parse(&referer) {
            if let Some(host) = ref_url.host_str() {
                req_builder = req_builder.header("Origin", format!("https://{}", host));
            }
        }
    }

    match req_builder.send() {
        Ok(resp) => {
            let base_url = Url::parse(&target_url).unwrap_or_else(|_| Url::parse("https://example.com").unwrap());
            let manifest_text = resp.text().unwrap_or_default();
            let mut rewritten_lines = Vec::new();

            for line in manifest_text.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if trimmed.starts_with('#') {
                    // Rewrite URI="..." attributes in #EXT-X-MEDIA
                    if trimmed.contains("URI=\"") {
                        let re_line = rewrite_tag_uris(trimmed, &base_url, &referer);
                        rewritten_lines.push(re_line);
                    } else {
                        rewritten_lines.push(trimmed.to_string());
                    }
                } else {
                    // Absolute or relative segment / subplaylist URL
                    let abs_url = if trimmed.starts_with("http") {
                        trimmed.to_string()
                    } else {
                        base_url.join(trimmed).map(|u| u.to_string()).unwrap_or_else(|_| trimmed.to_string())
                    };

                    let endpoint = if abs_url.contains(".m3u8") {
                        "/api/proxy/hls"
                    } else {
                        "/api/proxy/segment"
                    };

                    let proxied = format!(
                        "{}?url={}{}",
                        endpoint,
                        urlencoding::encode(&abs_url),
                        if !referer.is_empty() {
                            format!("&referer={}", urlencoding::encode(&referer))
                        } else {
                            "".to_string()
                        }
                    );
                    rewritten_lines.push(proxied);
                }
            }

            let final_manifest = rewritten_lines.join("\n");
            let mut res = Response::from_string(final_manifest);
            res.add_header(Header::from_bytes(&b"Content-Type"[..], &b"application/vnd.apple.mpegurl"[..]).unwrap());
            for h in cors_headers() {
                res.add_header(h);
            }
            let _ = request.respond(res);
        }
        Err(e) => {
            let _ = request.respond(json_response(format!(r#"{{"error":"{}"}}"#, e), 502));
        }
    }
}

fn rewrite_tag_uris(line: &str, base: &Url, referer: &str) -> String {
    // Replace URI="path" with proxied path
    let mut result = String::new();
    let mut parts = line.split("URI=\"");
    if let Some(first) = parts.next() {
        result.push_str(first);
        for part in parts {
            if let Some(idx) = part.find('"') {
                let uri = &part[..idx];
                let rest = &part[idx..];
                let abs = if uri.starts_with("http") {
                    uri.to_string()
                } else {
                    base.join(uri).map(|u| u.to_string()).unwrap_or_else(|_| uri.to_string())
                };
                let endpoint = if abs.contains(".m3u8") {
                    "/api/proxy/hls"
                } else {
                    "/api/proxy/segment"
                };
                let proxied = format!(
                    "{}?url={}{}",
                    endpoint,
                    urlencoding::encode(&abs),
                    if !referer.is_empty() {
                        format!("&referer={}", urlencoding::encode(referer))
                    } else {
                        "".to_string()
                    }
                );
                result.push_str(&format!("URI=\"{}{}", proxied, rest));
            } else {
                result.push_str("URI=\"");
                result.push_str(part);
            }
        }
    }
    result
}

fn handle_segment_proxy(request: tiny_http::Request, url: &Url, client: &reqwest::blocking::Client) {
    let mut target_url = String::new();
    let mut referer = String::new();

    for (k, v) in url.query_pairs() {
        if k == "url" {
            target_url = v.to_string();
        } else if k == "referer" {
            referer = v.to_string();
        }
    }

    if target_url.is_empty() {
        let _ = request.respond(json_response(r#"{"error":"Missing url parameter"}"#.into(), 400));
        return;
    }

    let mut req_builder = client.get(&target_url);
    if !referer.is_empty() {
        req_builder = req_builder.header("Referer", referer);
    }

    match req_builder.send() {
        Ok(resp) => {
            let bytes = resp.bytes().unwrap_or_default().to_vec();
            let mut res = Response::from_data(bytes);
            res.add_header(Header::from_bytes(&b"Content-Type"[..], &b"video/MP2T"[..]).unwrap());
            res.add_header(Header::from_bytes(&b"Cache-Control"[..], &b"public, max-age=3600"[..]).unwrap());
            for h in cors_headers() {
                res.add_header(h);
            }
            let _ = request.respond(res);
        }
        Err(e) => {
            let _ = request.respond(json_response(format!(r#"{{"error":"{}"}}"#, e), 502));
        }
    }
}
