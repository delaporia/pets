use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum PersonalityMode {
    Quiet,
    #[default]
    Balanced,
    Lively,
    Test,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PetCareState {
    pub satiety: f64,
    pub energy: f64,
    pub affection: f64,
    pub last_updated_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub schema_version: u32,
    pub selected_pet_id: String,
    #[serde(default)]
    pub personality_mode: PersonalityMode,
    pub activity_paused: bool,
    pub visible: bool,
    pub autostart: bool,
    #[serde(default = "legacy_care_model_version")]
    pub care_model_version: u32,
    #[serde(default = "default_pet_scale")]
    pub pet_scale: f64,
    #[serde(default)]
    pub care_by_pet: HashMap<String, PetCareState>,
}

fn default_pet_scale() -> f64 {
    1.0
}

fn legacy_care_model_version() -> u32 {
    1
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            selected_pet_id: String::new(),
            personality_mode: PersonalityMode::Balanced,
            activity_paused: false,
            visible: true,
            autostart: true,
            care_model_version: 2,
            pet_scale: default_pet_scale(),
            care_by_pet: HashMap::new(),
        }
    }
}

pub fn parse_settings(json: &str) -> Result<UserSettings, AppError> {
    let settings: UserSettings = serde_json::from_str(json)?;
    if settings.schema_version != 1 {
        return Err(AppError::message(format!(
            "unsupported settings schema version {}",
            settings.schema_version
        )));
    }
    validate_care_states(&settings)?;
    Ok(settings)
}

fn validate_care_states(settings: &UserSettings) -> Result<(), AppError> {
    if ![1, 2].contains(&settings.care_model_version) {
        return Err(AppError::message("unsupported careModelVersion"));
    }
    if ![0.75, 1.0, 1.25, 1.5].contains(&settings.pet_scale) {
        return Err(AppError::message("petScale must be 0.75, 1, 1.25 or 1.5"));
    }
    for (pet_id, care) in &settings.care_by_pet {
        if pet_id.is_empty() {
            return Err(AppError::message("care pet id must not be empty"));
        }
        for (name, value) in [
            ("satiety", care.satiety),
            ("energy", care.energy),
            ("affection", care.affection),
        ] {
            if !value.is_finite() || !(0.0..=100.0).contains(&value) {
                return Err(AppError::message(format!(
                    "{pet_id} care {name} must be between 0 and 100"
                )));
            }
        }
        if !care.last_updated_at.is_finite() || care.last_updated_at < 0.0 {
            return Err(AppError::message(format!(
                "{pet_id} care lastUpdatedAt must be non-negative"
            )));
        }
    }
    Ok(())
}

#[allow(dead_code)]
pub fn normalize_selected_pet(
    settings: &mut UserSettings,
    available: &[String],
    default_pet: &str,
) {
    if !available.contains(&settings.selected_pet_id) {
        settings.selected_pet_id = default_pet.to_string();
    }
}

pub fn temporary_settings_path(final_path: &Path) -> PathBuf {
    let name = final_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("settings.json");
    final_path.with_file_name(format!("{name}.tmp"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app.path().app_config_dir()?.join("settings.json"))
}

fn test_mode_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app.path().app_config_dir()?.join("test-mode.json"))
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct TestModeConfig {
    #[serde(default)]
    enabled: bool,
}

pub fn parse_test_mode_enabled(json: &str) -> bool {
    serde_json::from_str::<TestModeConfig>(json)
        .map(|config| config.enabled)
        .unwrap_or(false)
}

#[tauri::command]
pub fn read_test_mode_enabled(app: AppHandle) -> Result<bool, AppError> {
    let path = test_mode_path(&app)?;
    if !path.exists() {
        return Ok(false);
    }
    match fs::read_to_string(path) {
        Ok(json) => Ok(parse_test_mode_enabled(&json)),
        Err(error) => {
            log::warn!("Unable to read test-mode.json: {error}");
            Ok(false)
        }
    }
}

#[tauri::command]
pub fn read_settings(app: AppHandle) -> Result<UserSettings, AppError> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(UserSettings::default());
    }
    let json = fs::read_to_string(&path)?;
    match parse_settings(&json) {
        Ok(settings) => Ok(settings),
        Err(error) => {
            let backup = path.with_extension(format!(
                "corrupt-{}.json",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_err(AppError::message)?
                    .as_secs()
            ));
            fs::rename(&path, backup)?;
            log::warn!("Recovered corrupt settings: {error}");
            Ok(UserSettings::default())
        }
    }
}

#[tauri::command]
pub fn write_settings(app: AppHandle, settings: UserSettings) -> Result<(), AppError> {
    if settings.schema_version != 1 {
        return Err(AppError::message("unsupported settings schema version"));
    }
    validate_care_states(&settings)?;
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = temporary_settings_path(&path);
    let json = serde_json::to_vec_pretty(&settings)?;
    let mut file = fs::File::create(&temporary)?;
    file.write_all(&json)?;
    file.sync_all()?;
    fs::rename(temporary, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn default_settings_are_stable() {
        let settings = UserSettings::default();
        assert_eq!(settings.schema_version, 1);
        assert_eq!(settings.selected_pet_id, "");
        assert_eq!(settings.personality_mode, PersonalityMode::Balanced);
        assert!(!settings.activity_paused);
        assert!(settings.visible);
        assert!(settings.autostart);
        assert!(settings.care_by_pet.is_empty());
    }

    #[test]
    fn parses_schema_version_one() {
        let json = r#"{
          "schemaVersion": 1,
          "selectedPetId": "wuyi",
          "personalityMode": "lively",
          "activityPaused": true,
          "visible": false,
          "autostart": false
        }"#;
        let settings = parse_settings(json).expect("valid settings");
        assert_eq!(settings.selected_pet_id, "wuyi");
        assert_eq!(settings.personality_mode, PersonalityMode::Lively);
        assert!(settings.activity_paused);
        assert!(!settings.visible);
    }

    #[test]
    fn rejects_corrupt_json() {
        assert!(parse_settings("{broken").is_err());
    }

    #[test]
    fn migrates_legacy_settings_to_balanced() {
        let json = r#"{
          "schemaVersion": 1,
          "selectedPetId": "wuyi",
          "activityPaused": false,
          "visible": true,
          "autostart": true
        }"#;
        let settings = parse_settings(json).expect("legacy settings");
        assert_eq!(settings.personality_mode, PersonalityMode::Balanced);
        assert!(settings.care_by_pet.is_empty());
    }

    #[test]
    fn parses_independent_pet_care_state() {
        let json = r#"{
          "schemaVersion": 1,
          "selectedPetId": "wuyi",
          "personalityMode": "balanced",
          "activityPaused": false,
          "visible": true,
          "autostart": true,
          "careByPet": {
            "wuyi": {
              "satiety": 72.5,
              "energy": 64,
              "affection": 81,
              "lastUpdatedAt": 1234
            }
          }
        }"#;
        let settings = parse_settings(json).expect("care settings");
        let care = settings.care_by_pet.get("wuyi").expect("wuyi care");
        assert_eq!(care.satiety, 72.5);
        assert_eq!(care.energy, 64.0);
        assert_eq!(care.affection, 81.0);
        assert_eq!(care.last_updated_at, 1234.0);
    }

    #[test]
    fn falls_back_when_selected_pet_is_unavailable() {
        let mut settings = UserSettings {
            selected_pet_id: "missing".into(),
            ..UserSettings::default()
        };
        normalize_selected_pet(
            &mut settings,
            &["placeholder".into(), "wuyi".into()],
            "placeholder",
        );
        assert_eq!(settings.selected_pet_id, "placeholder");
    }

    #[test]
    fn temporary_path_differs_from_final_path() {
        let final_path = Path::new("/tmp/settings.json");
        let temp = temporary_settings_path(final_path);
        assert_ne!(temp, final_path);
        assert_eq!(temp.file_name().unwrap(), "settings.json.tmp");
    }

    #[test]
    fn enables_test_mode_only_for_an_explicit_valid_config() {
        assert!(parse_test_mode_enabled(r#"{"enabled":true}"#));
        assert!(!parse_test_mode_enabled(r#"{"enabled":false}"#));
        assert!(!parse_test_mode_enabled("{}"));
        assert!(!parse_test_mode_enabled("{broken"));
    }
}
