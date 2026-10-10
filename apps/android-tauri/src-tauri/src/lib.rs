// The app is the React frontend in frontend/dist; Rust only opens the WebView.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running JunkSnap");
}
