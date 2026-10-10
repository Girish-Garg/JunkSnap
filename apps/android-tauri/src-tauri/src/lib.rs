// The app is the React frontend in frontend/dist; Rust only opens the WebView and adds two
// plugins: opener (target=_blank links open in the browser) and sharekit (share letter text).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sharekit::init())
        .run(tauri::generate_context!())
        .expect("error while running JunkSnap");
}
