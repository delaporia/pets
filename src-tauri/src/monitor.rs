use crate::error::AppError;
use serde::Serialize;
use tauri::WebviewWindow;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkArea {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scale_factor: f64,
}

pub fn primary_work_area_for(window: &WebviewWindow) -> Result<WorkArea, AppError> {
    let monitor = window
        .primary_monitor()?
        .ok_or_else(|| AppError::message("primary monitor is unavailable"))?;
    let scale = monitor.scale_factor();
    let position = monitor.position();
    let size = monitor.size();
    Ok(WorkArea {
        x: position.x as f64 / scale,
        y: position.y as f64 / scale,
        width: size.width as f64 / scale,
        height: size.height as f64 / scale,
        scale_factor: scale,
    })
}

#[tauri::command]
pub fn primary_work_area(window: WebviewWindow) -> Result<WorkArea, AppError> {
    primary_work_area_for(&window)
}
