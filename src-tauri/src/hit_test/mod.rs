use crate::error::AppError;
use serde::Deserialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HitMaskPayload {
    pub width: u32,
    pub height: u32,
    pub threshold: u8,
    pub pixels: Vec<u8>,
}

#[derive(Debug, Default)]
pub struct HitTestState {
    mask: Option<HitMaskPayload>,
    interaction_locked: bool,
    last_interactive: Option<bool>,
}

impl HitTestState {
    fn hit(&self, x: f64, y: f64, window_width: f64, window_height: f64) -> bool {
        if self.interaction_locked {
            return true;
        }
        let Some(mask) = &self.mask else {
            return true;
        };
        if x < 0.0 || y < 0.0 || x >= window_width || y >= window_height {
            return false;
        }
        let mask_x = ((x / window_width) * mask.width as f64).floor() as u32;
        let mask_y = ((y / window_height) * mask.height as f64).floor() as u32;
        let index = (mask_y * mask.width + mask_x) as usize;
        mask.pixels
            .get(index)
            .is_some_and(|alpha| *alpha >= mask.threshold)
    }
}

#[derive(Default)]
pub struct HitTestController {
    inner: Mutex<HitTestState>,
}

#[tauri::command]
pub fn update_hit_mask(
    controller: State<'_, HitTestController>,
    mask: HitMaskPayload,
) -> Result<(), AppError> {
    let expected = mask.width as usize * mask.height as usize;
    if mask.width == 0 || mask.height == 0 || mask.pixels.len() != expected {
        return Err(AppError::message("invalid alpha hit mask dimensions"));
    }
    controller
        .inner
        .lock()
        .map_err(AppError::message)?
        .mask = Some(mask);
    Ok(())
}

#[tauri::command]
pub fn lock_pet_interaction(
    controller: State<'_, HitTestController>,
    locked: bool,
) -> Result<(), AppError> {
    controller
        .inner
        .lock()
        .map_err(AppError::message)?
        .interaction_locked = locked;
    Ok(())
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(16));
        let Some(window) = app.get_webview_window("pet") else {
            break;
        };
        if !window.is_visible().unwrap_or(false) {
            continue;
        }
        let Ok(cursor) = window.cursor_position() else {
            continue;
        };
        let Ok(position) = window.outer_position() else {
            continue;
        };
        let Ok(size) = window.outer_size() else {
            continue;
        };
        let Ok(scale) = window.scale_factor() else {
            continue;
        };
        let local_x = (cursor.x - position.x as f64) / scale;
        let local_y = (cursor.y - position.y as f64) / scale;
        let width = size.width as f64 / scale;
        let height = size.height as f64 / scale;

        let Some(controller) = app.try_state::<HitTestController>() else {
            continue;
        };
        let decision = {
            let Ok(mut state) = controller.inner.lock() else {
                continue;
            };
            let interactive = state.hit(local_x, local_y, width, height);
            if state.last_interactive == Some(interactive) {
                None
            } else {
                state.last_interactive = Some(interactive);
                Some(interactive)
            }
        };
        if let Some(interactive) = decision {
            let _ = window.set_ignore_cursor_events(!interactive);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> HitTestState {
        HitTestState {
            mask: Some(HitMaskPayload {
                width: 2,
                height: 2,
                threshold: 128,
                pixels: vec![0, 127, 128, 255],
            }),
            interaction_locked: false,
            last_interactive: None,
        }
    }

    #[test]
    fn outside_coordinates_are_misses() {
        let state = state();
        assert!(!state.hit(-1.0, 0.0, 2.0, 2.0));
        assert!(!state.hit(2.0, 0.0, 2.0, 2.0));
    }

    #[test]
    fn alpha_at_threshold_is_a_hit() {
        let state = state();
        assert!(!state.hit(1.0, 0.0, 2.0, 2.0));
        assert!(state.hit(0.0, 1.0, 2.0, 2.0));
        assert!(state.hit(1.0, 1.0, 2.0, 2.0));
    }

    #[test]
    fn scales_logical_window_coordinates_to_mask_pixels() {
        let state = state();
        assert!(state.hit(75.0, 75.0, 100.0, 100.0));
        assert!(!state.hit(75.0, 25.0, 100.0, 100.0));
    }

    #[test]
    fn interaction_lock_always_hits() {
        let mut state = state();
        state.interaction_locked = true;
        assert!(state.hit(-100.0, -100.0, 2.0, 2.0));
    }
}
