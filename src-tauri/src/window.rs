use crate::error::AppError;
use crate::monitor::primary_work_area_for;
use serde::Serialize;
use tauri::{
    LogicalPosition, LogicalSize, PhysicalPosition, WebviewWindow,
};

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct LogicalPoint {
    x: f64,
    y: f64,
}

fn physical_to_logical(
    position: PhysicalPosition<f64>,
    scale_factor: f64,
) -> LogicalPoint {
    let scale = if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    };
    LogicalPoint {
        x: position.x / scale,
        y: position.y / scale,
    }
}

#[tauri::command]
pub fn cursor_position(window: WebviewWindow) -> Result<LogicalPoint, AppError> {
    Ok(physical_to_logical(
        window.cursor_position()?,
        window.scale_factor()?,
    ))
}

#[tauri::command]
pub fn move_pet_window(window: WebviewWindow, x: f64, y: f64) -> Result<(), AppError> {
    let work_area = primary_work_area_for(&window)?;
    let scale = window.scale_factor()?;
    let size = window.outer_size()?;
    let width = size.width as f64 / scale;
    let height = size.height as f64 / scale;
    let clamped_x = x.clamp(work_area.x, work_area.x + work_area.width - width);
    let clamped_y = y.clamp(work_area.y, work_area.y + work_area.height - height);
    window.set_position(LogicalPosition::new(clamped_x, clamped_y))?;
    Ok(())
}

#[tauri::command]
pub fn set_pet_visible(window: WebviewWindow, visible: bool) -> Result<(), AppError> {
    if visible {
        window.show()?;
    } else {
        window.hide()?;
    }
    Ok(())
}

#[tauri::command]
pub fn resize_pet_window(
    window: WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), AppError> {
    if width <= 0.0 || height <= 0.0 {
        return Err(AppError::message("window dimensions must be positive"));
    }
    window.set_size(LogicalSize::new(width, height))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_physical_cursor_coordinates_to_logical_points() {
        assert_eq!(
            physical_to_logical(PhysicalPosition::new(300.0, 150.0), 1.5),
            LogicalPoint { x: 200.0, y: 100.0 }
        );
    }
}
