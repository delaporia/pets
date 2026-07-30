use crate::error::AppError;
use crate::monitor::primary_work_area_for;
use serde::Serialize;
use tauri::{
    LogicalPosition, LogicalSize, PhysicalPosition, WebviewWindow,
};

#[derive(Debug, Clone, Copy, PartialEq)]
struct LogicalBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WindowUpdatePlan {
    resize: bool,
    reposition: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct LogicalPoint {
    x: f64,
    y: f64,
}

fn window_update_plan(current: LogicalBounds, target: LogicalBounds) -> WindowUpdatePlan {
    const TOLERANCE: f64 = 0.5;
    WindowUpdatePlan {
        resize: (current.width - target.width).abs() > TOLERANCE
            || (current.height - target.height).abs() > TOLERANCE,
        reposition: (current.x - target.x).abs() > TOLERANCE
            || (current.y - target.y).abs() > TOLERANCE,
    }
}

fn clamp_window_bounds(
    work_area: &crate::monitor::WorkArea,
    bounds: LogicalBounds,
) -> LogicalBounds {
    let width = bounds.width.min(work_area.width);
    let height = bounds.height.min(work_area.height);
    LogicalBounds {
        x: bounds
            .x
            .clamp(work_area.x, work_area.x + work_area.width - width),
        y: bounds
            .y
            .clamp(work_area.y, work_area.y + work_area.height - height),
        width,
        height,
    }
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

#[tauri::command]
pub fn resize_and_move_pet_window(
    window: WebviewWindow,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), AppError> {
    if !x.is_finite()
        || !y.is_finite()
        || !width.is_finite()
        || !height.is_finite()
        || width <= 0.0
        || height <= 0.0
    {
        return Err(AppError::message("window bounds must be finite and positive"));
    }
    let work_area = primary_work_area_for(&window)?;
    let bounds = clamp_window_bounds(
        &work_area,
        LogicalBounds {
            x,
            y,
            width,
            height,
        },
    );
    let scale = window.scale_factor()?;
    let current_size = window.outer_size()?;
    let current_position = window.outer_position()?;
    let current = LogicalBounds {
        x: current_position.x as f64 / scale,
        y: current_position.y as f64 / scale,
        width: current_size.width as f64 / scale,
        height: current_size.height as f64 / scale,
    };
    let plan = window_update_plan(current, bounds);
    if plan.resize {
        window.set_size(LogicalSize::new(bounds.width, bounds.height))?;
    }
    if plan.reposition {
        window.set_position(LogicalPosition::new(bounds.x, bounds.y))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::monitor::WorkArea;

    #[test]
    fn converts_physical_cursor_coordinates_to_logical_points() {
        assert_eq!(
            physical_to_logical(PhysicalPosition::new(300.0, 150.0), 1.5),
            LogicalPoint { x: 200.0, y: 100.0 }
        );
    }

    #[test]
    fn clamps_atomic_window_bounds_inside_the_work_area() {
        let work_area = WorkArea {
            x: -1920.0,
            y: 25.0,
            width: 1920.0,
            height: 1055.0,
            scale_factor: 1.0,
        };

        assert_eq!(
            clamp_window_bounds(
                &work_area,
                LogicalBounds {
                    x: -2000.0,
                    y: 980.0,
                    width: 360.0,
                    height: 240.0,
                },
            ),
            LogicalBounds {
                x: -1920.0,
                y: 840.0,
                width: 360.0,
                height: 240.0,
            },
        );
    }

    #[test]
    fn avoids_redundant_resize_during_position_only_updates() {
        assert_eq!(
            window_update_plan(
                LogicalBounds {
                    x: 100.0,
                    y: 200.0,
                    width: 320.0,
                    height: 240.0,
                },
                LogicalBounds {
                    x: 108.0,
                    y: 200.0,
                    width: 320.0,
                    height: 240.0,
                },
            ),
            WindowUpdatePlan {
                resize: false,
                reposition: true,
            },
        );
    }
}
