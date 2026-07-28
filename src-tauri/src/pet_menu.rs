use crate::error::AppError;
use crate::settings::PersonalityMode;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, WebviewWindow,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuPet {
    pub id: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CareSummary {
    pub satiety: f64,
    pub energy: f64,
    pub affection: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetMenuState {
    pub pets: Vec<MenuPet>,
    pub selected_pet_id: String,
    pub personality_mode: PersonalityMode,
    pub test_mode_enabled: bool,
    pub paused: bool,
    pub sleeping: bool,
    pub care: CareSummary,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct MenuDescriptor {
    id: String,
    label: String,
    checked: Option<bool>,
}

fn menu_model(state: &PetMenuState) -> Vec<MenuDescriptor> {
    let mut items = vec![
        descriptor("care:pet", "抚摸", None),
        descriptor("care:feed", "喂食", None),
        descriptor("care:play", "玩耍", None),
        descriptor(
            if state.sleeping {
                "care:wake"
            } else {
                "care:sleep"
            },
            if state.sleeping { "唤醒" } else { "睡觉" },
            None,
        ),
        descriptor(
            "status:satiety",
            &format!("饱腹度  {:.0}", state.care.satiety),
            None,
        ),
        descriptor(
            "status:energy",
            &format!("精力  {:.0}", state.care.energy),
            None,
        ),
        descriptor(
            "status:affection",
            &format!("亲密度  {:.0}", state.care.affection),
            None,
        ),
    ];
    items.extend(state.pets.iter().map(|pet| {
        descriptor(
            &format!("pet:{}", pet.id),
            &pet.display_name,
            Some(pet.id == state.selected_pet_id),
        )
    }));
    items.extend([
        descriptor(
            "personality:quiet",
            "安静陪伴",
            Some(state.personality_mode == PersonalityMode::Quiet),
        ),
        descriptor(
            "personality:balanced",
            "平衡模式",
            Some(state.personality_mode == PersonalityMode::Balanced),
        ),
        descriptor(
            "personality:lively",
            "活泼互动",
            Some(state.personality_mode == PersonalityMode::Lively),
        ),
    ]);
    if state.test_mode_enabled {
        items.push(descriptor(
            "personality:test",
            "测试模式",
            Some(state.personality_mode == PersonalityMode::Test),
        ));
    }
    items.extend([
        descriptor("pause", "暂停活动", Some(state.paused)),
        descriptor("hide", "隐藏宠物", None),
        descriptor("quit", "退出", None),
    ]);
    items
}

fn descriptor(id: &str, label: &str, checked: Option<bool>) -> MenuDescriptor {
    MenuDescriptor {
        id: id.into(),
        label: label.into(),
        checked,
    }
}

fn context_id(id: &str) -> String {
    format!("pet-menu:{id}")
}

fn build_menu(app: &AppHandle, state: &PetMenuState) -> Result<Menu<tauri::Wry>, AppError> {
    let menu = Menu::new(app)?;
    for (id, label) in [
        ("care:pet", "抚摸"),
        ("care:feed", "喂食"),
        ("care:play", "玩耍"),
        (
            if state.sleeping {
                "care:wake"
            } else {
                "care:sleep"
            },
            if state.sleeping { "唤醒" } else { "睡觉" },
        ),
    ] {
        menu.append(&MenuItem::with_id(
            app,
            context_id(id),
            label,
            true,
            None::<&str>,
        )?)?;
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    let status = Submenu::with_id(app, context_id("status"), "当前状态", true)?;
    for descriptor in menu_model(state)
        .into_iter()
        .filter(|item| item.id.starts_with("status:"))
    {
        status.append(&MenuItem::with_id(
            app,
            context_id(&descriptor.id),
            descriptor.label,
            false,
            None::<&str>,
        )?)?;
    }
    menu.append(&status)?;

    let pets = Submenu::with_id(app, context_id("pets"), "选择宠物", true)?;
    for pet in &state.pets {
        pets.append(&CheckMenuItem::with_id(
            app,
            context_id(&format!("pet:{}", pet.id)),
            &pet.display_name,
            true,
            pet.id == state.selected_pet_id,
            None::<&str>,
        )?)?;
    }
    menu.append(&pets)?;

    let personalities =
        Submenu::with_id(app, context_id("personalities"), "性格模式", true)?;
    let mut personality_modes = vec![
        (PersonalityMode::Quiet, "安静陪伴"),
        (PersonalityMode::Balanced, "平衡模式"),
        (PersonalityMode::Lively, "活泼互动"),
    ];
    if state.test_mode_enabled {
        personality_modes.push((PersonalityMode::Test, "测试模式"));
    }
    for (mode, label) in personality_modes {
        let mode_id = format!("{mode:?}").to_lowercase();
        personalities.append(&CheckMenuItem::with_id(
            app,
            context_id(&format!("personality:{mode_id}")),
            label,
            true,
            mode == state.personality_mode,
            None::<&str>,
        )?)?;
    }
    menu.append(&personalities)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&CheckMenuItem::with_id(
        app,
        context_id("pause"),
        "暂停活动",
        true,
        state.paused,
        None::<&str>,
    )?)?;
    menu.append(&MenuItem::with_id(
        app,
        context_id("hide"),
        "隐藏宠物",
        true,
        None::<&str>,
    )?)?;
    menu.append(&MenuItem::with_id(
        app,
        context_id("quit"),
        "退出",
        true,
        None::<&str>,
    )?)?;
    Ok(menu)
}

#[tauri::command]
pub fn show_pet_menu(window: WebviewWindow, state: PetMenuState) -> Result<(), AppError> {
    let menu = build_menu(window.app_handle(), &state)?;
    window.popup_menu(&menu)?;
    Ok(())
}

pub fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let Some(id) = event.id().as_ref().strip_prefix("pet-menu:") else {
        return;
    };
    if let Some(action) = id.strip_prefix("care:") {
        let _ = app.emit("pet-menu://action", action.to_string());
    } else if let Some(pet_id) = id.strip_prefix("pet:") {
        let _ = app.emit("tray://select-pet", pet_id.to_string());
    } else if let Some(mode) = id.strip_prefix("personality:") {
        let _ = app.emit("tray://select-personality", mode.to_string());
    } else {
        match id {
            "pause" => {
                let _ = app.emit("tray://pause", ());
            }
            "hide" => {
                let _ = app.emit("tray://visibility", ());
            }
            "quit" => app.exit(0),
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> PetMenuState {
        PetMenuState {
            pets: vec![
                MenuPet {
                    id: "wuyi".into(),
                    display_name: "五一".into(),
                },
                MenuPet {
                    id: "ying".into(),
                    display_name: "瑛".into(),
                },
            ],
            selected_pet_id: "wuyi".into(),
            personality_mode: PersonalityMode::Balanced,
            test_mode_enabled: false,
            paused: false,
            sleeping: false,
            care: CareSummary {
                satiety: 72.0,
                energy: 64.0,
                affection: 81.0,
            },
        }
    }

    #[test]
    fn includes_care_actions_and_current_status() {
        let items = menu_model(&state());

        assert!(items.iter().any(|item| item.id == "care:feed"));
        assert!(items
            .iter()
            .any(|item| item.id == "status:satiety" && item.label.contains("72")));
        assert!(items
            .iter()
            .any(|item| item.id == "status:energy" && item.label.contains("64")));
        assert!(items
            .iter()
            .any(|item| item.id == "status:affection" && item.label.contains("81")));
    }

    #[test]
    fn offers_sleep_or_wake_according_to_runtime_state() {
        let awake = menu_model(&state());
        assert!(awake.iter().any(|item| item.id == "care:sleep"));

        let sleeping = menu_model(&PetMenuState {
            sleeping: true,
            ..state()
        });
        assert!(sleeping.iter().any(|item| item.id == "care:wake"));
        assert!(!sleeping.iter().any(|item| item.id == "care:sleep"));
    }

    #[test]
    fn marks_exactly_one_pet_and_personality() {
        let items = menu_model(&state());
        assert_eq!(
            items
                .iter()
                .filter(|item| item.id.starts_with("pet:") && item.checked == Some(true))
                .count(),
            1
        );
        assert_eq!(
            items
                .iter()
                .filter(|item| {
                    item.id.starts_with("personality:") && item.checked == Some(true)
                })
                .count(),
            1
        );
    }

    #[test]
    fn hides_test_personality_without_the_private_config() {
        let hidden = menu_model(&state());
        assert!(!hidden.iter().any(|item| item.id == "personality:test"));

        let visible = menu_model(&PetMenuState {
            test_mode_enabled: true,
            ..state()
        });
        assert!(visible.iter().any(|item| item.id == "personality:test"));
    }
}
