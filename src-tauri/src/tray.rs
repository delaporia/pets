use crate::error::AppError;
use crate::settings::PersonalityMode;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Emitter, Manager, State, Wry,
};

fn tray_icon() -> Image<'static> {
    tauri::include_image!("./icons/tray-32.png")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayPet {
    pub id: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayState {
    pub pets: Vec<TrayPet>,
    pub selected_pet_id: String,
    pub personality_mode: PersonalityMode,
    pub test_mode_enabled: bool,
    pub paused: bool,
    pub visible: bool,
    pub autostart: bool,
    pub pet_scale: f64,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MenuDescriptor {
    pub id: String,
    pub checked: Option<bool>,
}

#[cfg(test)]
pub fn menu_model(state: &TrayState) -> Vec<MenuDescriptor> {
    let mut items = state
        .pets
        .iter()
        .map(|pet| MenuDescriptor {
            id: format!("pet:{}", pet.id),
            checked: Some(pet.id == state.selected_pet_id),
        })
        .collect::<Vec<_>>();
    for mode in [
        PersonalityMode::Quiet,
        PersonalityMode::Balanced,
        PersonalityMode::Lively,
    ]
    .into_iter()
    .chain(state.test_mode_enabled.then_some(PersonalityMode::Test))
    {
        items.push(MenuDescriptor {
            id: format!("personality:{mode:?}").to_lowercase(),
            checked: Some(mode == state.personality_mode),
        });
    }
    for scale in [0.75, 1.0, 1.25, 1.5] {
        items.push(MenuDescriptor {
            id: format!("scale:{scale}"),
            checked: Some(scale == state.pet_scale),
        });
    }
    items.extend([
        MenuDescriptor {
            id: "pause".into(),
            checked: Some(state.paused),
        },
        MenuDescriptor {
            id: "visible".into(),
            checked: Some(state.visible),
        },
        MenuDescriptor {
            id: "autostart".into(),
            checked: Some(state.autostart),
        },
        MenuDescriptor {
            id: "quit".into(),
            checked: None,
        },
    ]);
    items
}

struct TraySlot<T> {
    current: Mutex<Option<T>>,
}

impl<T> Default for TraySlot<T> {
    fn default() -> Self {
        Self {
            current: Mutex::new(None),
        }
    }
}

impl<T> TraySlot<T> {
    fn configure_with_existing<E>(
        &self,
        find_existing: impl FnOnce() -> Option<T>,
        create: impl FnOnce() -> Result<T, E>,
        update: impl FnOnce(&T) -> Result<(), E>,
    ) -> Result<(), E> {
        let mut current = self
            .current
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(tray) = current.as_ref() {
            update(tray)
        } else if let Some(tray) = find_existing() {
            update(&tray)?;
            *current = Some(tray);
            Ok(())
        } else {
            *current = Some(create()?);
            Ok(())
        }
    }
}

#[derive(Clone)]
struct ExclusiveCheckGroup<T> {
    items: Vec<(String, T)>,
}

impl<T> Default for ExclusiveCheckGroup<T> {
    fn default() -> Self {
        Self { items: Vec::new() }
    }
}

impl<T> ExclusiveCheckGroup<T> {
    fn new(items: Vec<(String, T)>) -> Self {
        Self { items }
    }

    fn select<E>(
        &self,
        selected_id: &str,
        mut set_checked: impl FnMut(&T, bool) -> Result<(), E>,
    ) -> Result<(), E> {
        for (id, item) in &self.items {
            set_checked(item, id == selected_id)?;
        }
        Ok(())
    }
}

#[derive(Default)]
pub struct TrayController {
    tray: TraySlot<TrayIcon>,
    pet_checks: Mutex<ExclusiveCheckGroup<CheckMenuItem<Wry>>>,
    personality_checks: Mutex<ExclusiveCheckGroup<CheckMenuItem<Wry>>>,
    scale_checks: Mutex<ExclusiveCheckGroup<CheckMenuItem<Wry>>>,
}

struct BuiltMenu {
    menu: Menu<Wry>,
    pet_checks: ExclusiveCheckGroup<CheckMenuItem<Wry>>,
    personality_checks: ExclusiveCheckGroup<CheckMenuItem<Wry>>,
    scale_checks: ExclusiveCheckGroup<CheckMenuItem<Wry>>,
}

fn build_menu(app: &AppHandle, state: &TrayState) -> Result<BuiltMenu, AppError> {
    let menu = Menu::new(app)?;
    let pets = Submenu::with_id(app, "pets", "选择宠物", true)?;
    let mut pet_checks = Vec::with_capacity(state.pets.len());
    for pet in &state.pets {
        let item = CheckMenuItem::with_id(
            app,
            format!("pet:{}", pet.id),
            &pet.display_name,
            true,
            pet.id == state.selected_pet_id,
            None::<&str>,
        )?;
        pets.append(&item)?;
        pet_checks.push((pet.id.clone(), item));
    }
    menu.append(&pets)?;
    let personalities = Submenu::with_id(app, "personalities", "性格模式", true)?;
    let mut personality_modes = vec![
        (PersonalityMode::Quiet, "安静陪伴"),
        (PersonalityMode::Balanced, "平衡模式"),
        (PersonalityMode::Lively, "活泼互动"),
    ];
    if state.test_mode_enabled {
        personality_modes.push((PersonalityMode::Test, "测试模式"));
    }
    let mut personality_checks = Vec::with_capacity(personality_modes.len());
    for (mode, label) in personality_modes {
        let id = format!("{mode:?}").to_lowercase();
        let item = CheckMenuItem::with_id(
            app,
            format!("personality:{id}"),
            label,
            true,
            mode == state.personality_mode,
            None::<&str>,
        )?;
        personalities.append(&item)?;
        personality_checks.push((id, item));
    }
    menu.append(&personalities)?;
    let sizes = Submenu::with_id(app, "sizes", "宠物大小", true)?;
    let mut scale_checks = Vec::new();
    for (scale, label) in [
        (0.75, "小（75%）"),
        (1.0, "标准（100%）"),
        (1.25, "大（125%）"),
        (1.5, "特大（150%）"),
    ] {
        let id = scale.to_string();
        let item = CheckMenuItem::with_id(
            app,
            format!("scale:{id}"),
            label,
            true,
            scale == state.pet_scale,
            None::<&str>,
        )?;
        sizes.append(&item)?;
        scale_checks.push((id, item));
    }
    menu.append(&sizes)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&CheckMenuItem::with_id(
        app,
        "pause",
        "暂停活动",
        true,
        state.paused,
        None::<&str>,
    )?)?;
    menu.append(&CheckMenuItem::with_id(
        app,
        "visible",
        "显示宠物",
        true,
        state.visible,
        None::<&str>,
    )?)?;
    menu.append(&CheckMenuItem::with_id(
        app,
        "autostart",
        "开机启动",
        true,
        state.autostart,
        None::<&str>,
    )?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(
        app,
        "quit",
        "退出",
        true,
        None::<&str>,
    )?)?;
    Ok(BuiltMenu {
        menu,
        pet_checks: ExclusiveCheckGroup::new(pet_checks),
        personality_checks: ExclusiveCheckGroup::new(personality_checks),
        scale_checks: ExclusiveCheckGroup::new(scale_checks),
    })
}

#[tauri::command]
pub fn configure_tray(
    app: AppHandle,
    controller: State<'_, TrayController>,
    state: TrayState,
) -> Result<(), AppError> {
    let built = build_menu(&app, &state)?;
    *controller
        .pet_checks
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = built.pet_checks;
    *controller
        .personality_checks
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = built.personality_checks;
    *controller
        .scale_checks
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = built.scale_checks;
    let menu = built.menu;
    let replacement_menu = menu.clone();
    controller.tray.configure_with_existing(
        || app.tray_by_id("desktop-pet"),
        || {
            let mut builder = TrayIconBuilder::with_id("desktop-pet")
                .menu(&menu)
                .tooltip("Delaporia Pet")
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    let id = event.id().as_ref();
                    if let Some(pet_id) = id.strip_prefix("pet:") {
                        let controller = app.state::<TrayController>();
                        let checks = controller
                            .pet_checks
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner());
                        let _ = checks.select(pet_id, |item, checked| {
                            item.set_checked(checked)
                        });
                        let _ = app.emit("tray://select-pet", pet_id.to_string());
                    } else if let Some(mode) = id.strip_prefix("personality:") {
                        let controller = app.state::<TrayController>();
                        let checks = controller
                            .personality_checks
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner());
                        let _ = checks.select(mode, |item, checked| {
                            item.set_checked(checked)
                        });
                        let _ = app.emit("tray://select-personality", mode.to_string());
                    } else if let Some(scale) = id.strip_prefix("scale:") {
                        if let Ok(value) = scale.parse::<f64>() {
                            let controller = app.state::<TrayController>();
                            let checks = controller
                                .scale_checks
                                .lock()
                                .unwrap_or_else(|poisoned| poisoned.into_inner());
                            let _ = checks.select(scale, |item, checked| {
                                item.set_checked(checked)
                            });
                            let _ = app.emit("tray://select-scale", value);
                        }
                    } else {
                        match id {
                            "pause" => {
                                let _ = app.emit("tray://pause", ());
                            }
                            "visible" => {
                                let _ = app.emit("tray://visibility", ());
                            }
                            "autostart" => {
                                let _ = app.emit("tray://autostart", ());
                            }
                            "quit" => app.exit(0),
                            _ => {}
                        }
                    }
                });
            builder = builder.icon(tray_icon());
            Ok(builder.build(&app)?)
        },
        |tray| {
            tray.set_menu(Some(replacement_menu))?;
            Ok(())
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> TrayState {
        TrayState {
            pets: vec![
                TrayPet {
                    id: "wuyi".into(),
                    display_name: "Wuyi".into(),
                },
                TrayPet {
                    id: "placeholder".into(),
                    display_name: "Placeholder".into(),
                },
            ],
            selected_pet_id: "wuyi".into(),
            personality_mode: PersonalityMode::Balanced,
            test_mode_enabled: false,
            paused: false,
            visible: true,
            autostart: true,
            pet_scale: 1.0,
        }
    }

    #[test]
    fn marks_the_selected_pet() {
        let items = menu_model(&state());
        assert!(items.iter().any(|item| {
            item.id == "pet:wuyi" && item.checked == Some(true)
        }));
        assert!(items.iter().any(|item| {
            item.id == "pet:placeholder" && item.checked == Some(false)
        }));
    }

    #[test]
    fn reflects_runtime_toggle_state() {
        let items = menu_model(&state());
        assert!(items.iter().any(|item| item.id == "pause" && item.checked == Some(false)));
        assert!(items.iter().any(|item| item.id == "visible" && item.checked == Some(true)));
        assert!(items.iter().any(|item| item.id == "autostart" && item.checked == Some(true)));
    }

    #[test]
    fn includes_a_quit_action() {
        let items = menu_model(&state());
        assert!(items.iter().any(|item| item.id == "quit" && item.checked.is_none()));
    }

    #[test]
    fn marks_the_selected_personality() {
        let items = menu_model(&state());
        assert!(items.iter().any(|item| {
            item.id == "personality:balanced" && item.checked == Some(true)
        }));
    }

    #[test]
    fn exposes_test_personality_only_when_the_config_enables_it() {
        let hidden = menu_model(&state());
        assert!(!hidden.iter().any(|item| item.id == "personality:test"));

        let visible = menu_model(&TrayState {
            test_mode_enabled: true,
            personality_mode: PersonalityMode::Test,
            ..state()
        });
        assert!(visible.iter().any(|item| {
            item.id == "personality:test" && item.checked == Some(true)
        }));
    }

    #[test]
    fn uses_a_dedicated_menu_bar_icon() {
        let icon = tray_icon();
        assert_eq!(icon.width(), 32);
        assert_eq!(icon.height(), 32);
    }

    #[test]
    fn reuses_the_existing_tray_when_the_menu_state_changes() {
        use std::cell::Cell;

        let slot = TraySlot::default();
        let create_count = Cell::new(0);
        let update_count = Cell::new(0);

        slot.configure_with_existing(
            || None,
            || {
                create_count.set(create_count.get() + 1);
                Ok::<_, ()>("desktop-pet")
            },
            |_| {
                update_count.set(update_count.get() + 1);
                Ok::<_, ()>(())
            },
        )
        .unwrap();
        slot.configure_with_existing(
            || None,
            || {
                create_count.set(create_count.get() + 1);
                Ok::<_, ()>("replacement")
            },
            |_| {
                update_count.set(update_count.get() + 1);
                Ok::<_, ()>(())
            },
        )
        .unwrap();

        assert_eq!(create_count.get(), 1);
        assert_eq!(update_count.get(), 1);
    }

    #[test]
    fn adopts_a_tray_already_registered_with_tauri() {
        use std::cell::Cell;

        let slot = TraySlot::default();
        let create_count = Cell::new(0);
        let update_count = Cell::new(0);

        slot.configure_with_existing(
            || Some("desktop-pet"),
            || {
                create_count.set(create_count.get() + 1);
                Ok::<_, ()>("replacement")
            },
            |_| {
                update_count.set(update_count.get() + 1);
                Ok::<_, ()>(())
            },
        )
        .unwrap();

        assert_eq!(create_count.get(), 0);
        assert_eq!(update_count.get(), 1);
    }

    #[test]
    fn pet_checks_are_exclusive_even_when_native_menu_items_toggle_themselves() {
        use std::cell::Cell;

        let checks = ExclusiveCheckGroup::new(vec![
            ("wuyi".into(), Cell::new(true)),
            ("ying".into(), Cell::new(false)),
        ]);

        // Windows toggles the clicked check item before dispatching the event.
        checks.items[1].1.set(true);
        checks
            .select("ying", |item, checked| {
                item.set(checked);
                Ok::<_, ()>(())
            })
            .unwrap();

        assert!(!checks.items[0].1.get());
        assert!(checks.items[1].1.get());

        // Clicking the selected pet must restore its check instead of clearing it.
        checks.items[1].1.set(false);
        checks
            .select("ying", |item, checked| {
                item.set(checked);
                Ok::<_, ()>(())
            })
            .unwrap();
        assert!(!checks.items[0].1.get());
        assert!(checks.items[1].1.get());
    }
}
