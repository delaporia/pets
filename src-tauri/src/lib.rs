mod error;
mod hit_test;
mod monitor;
mod pet_menu;
mod settings;
mod tray;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("pet") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(hit_test::HitTestController::default())
        .manage(tray::TrayController::default())
        .on_menu_event(pet_menu::handle_menu_event)
        .setup(|app| {
            hit_test::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            hit_test::lock_pet_interaction,
            hit_test::update_hit_mask,
            monitor::primary_work_area,
            pet_menu::show_pet_menu,
            settings::read_settings,
            settings::read_test_mode_enabled,
            settings::write_settings,
            tray::configure_tray,
            window::cursor_position,
            window::move_pet_window,
            window::resize_pet_window,
            window::set_pet_visible
        ])
        .run(tauri::generate_context!())
        .expect("error while running desktop pet");
}
