// src/lib/i18n/index.ts

export type Translations = {
  nav: {
    calendar: string
    weekPlanner: string
    recipes: string
    shopping: string
    tasks: string
    settings: string
    signOut: string
  }
  home: {
    welcomeTitle: string
    welcomeSubtitle: string
    signInWithGoogle: string
    or: string
    goodMorning: string
    goodAfternoon: string
    goodEvening: string
    tasksThisWeek: string
    allTasks: string
    noWeekYet: string
    goToWeekPlanning: string
    previous: string
    next: string
  }
  week: {
    title: string
    planNextWeek: string
    planning: string
    noWeeksYet: string
    generateShopping: string
  }
  weekBlock: {
    weather: string
    events: string
    location: string
    lunch: string
    dinner: string
    allDay: string
    locationPlaceholder: string
    lunchPlaceholder: string
    dinnerPlaceholder: string
  }
  calendar: {
    title: string
  }
  meals: {
    title: string
    newRecipe: string
    allTypes: string
    allDiets: string
    typeMeal: string
    typeSnack: string
    typeDrink: string
    typeBaked: string
    dietMeat: string
    dietFish: string
    dietVegetarian: string
    officeFilter: string
    quickFilter: string
    noRecipesMatch: string
    noRecipesYet: string
    aiImport: string
    nameLabel: string
    typeLabel: string
    dietLabel: string
    servingsLabel: string
    officeLabel: string
    quickLabel: string
    notesLabel: string
    sourceLabel: string
    ingredientsLabel: string
    stepsLabel: string
    ingredientsHint: string
    stepsHint: string
    saveRecipe: string
    savingRecipe: string
    addPhoto: string
    insertRecipeOrUrl: string
    import: string
    importing: string
  }
  tasks: {
    title: string
    newTask: string
    overdue: string
    thisWeek: string
    later: string
    allMembers: string
    noTasksDue: string
    noTasksMatch: string
    taskNamePlaceholder: string
    descriptionPlaceholder: string
    dueDateLabel: string
    assigneesLabel: string
    nameRequired: string
    dueDateRequired: string
    deleteTask: string
    deleting: string
  }
  shopping: {
    title: string
    qty: string
    addItem: string
    other: string
  }
  onboarding: {
    createFamily: string
    joinFamily: string
    creating: string
    joining: string
    familyNamePlaceholder: string
    cityPlaceholder: string
    joinCodePlaceholder: string
  }
  settings: {
    title: string
    profile: string
    googleCalendar: string
    location: string
    family: string
    shopping: string
    language: string
    profileDesc: string
    profileNameLabel: string
    profileNamePlaceholder: string
    locationDesc: string
    homeCityLabel: string
    homeCityPlaceholder: string
    save: string
    saving: string
    saved: string
    cancel: string
    loading: string
    loadingCalendars: string
    retry: string
    remove: string
    confirmQuestion: string
    generate: string
    generating: string
    addCalendar: string
    adding: string
    importedCalendarsTitle: string
    importedCalendarsDesc: string
    noImportedCalendars: string
    noGoogleCalendars: string
    googleCalendarDesc: string
    colorLabel: string
    calendarNamePlaceholder: string
    familyNameLabel: string
    familyNamePlaceholder: string
    joinCodeLabel: string
    joinCodeDesc: string
    membersTitle: string
    membersDesc: string
    addMember: string
    addMemberTitle: string
    resetPassword: string
    deactivate: string
    activate: string
    you: string
    categoriesTitle: string
    blacklistTitle: string
    blacklistDesc: string
    rename: string
    add: string
    newCategoryPlaceholder: string
    newTermPlaceholder: string
    languageTitle: string
    languageDesc: string
    chooseLanguage: string
    roleMember: string
    roleParent: string
    roleAdmin: string
    newPasswordPlaceholder: string
    creating: string
    nameLabel: string
    usernameLabel: string
    passwordLabel: string
    failedSave: string
  }
}

const en: Translations = {
  nav: {
    calendar: "Calendar",
    weekPlanner: "Week Planner",
    recipes: "Recipes",
    shopping: "Shopping",
    tasks: "Tasks",
    settings: "Settings",
    signOut: "Sign out",
  },
  home: {
    welcomeTitle: "Welcome to YourKieke",
    welcomeSubtitle: "Your shared family management hub.",
    signInWithGoogle: "Sign in with Google",
    or: "or",
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    tasksThisWeek: "Tasks this week",
    allTasks: "→ All tasks",
    noWeekYet: "No plan for this week yet.",
    goToWeekPlanning: "Go to week planning →",
    previous: "Previous",
    next: "Next",
  },
  week: {
    title: "Week Planner",
    planNextWeek: "Plan next week",
    planning: "Planning…",
    noWeeksYet: "No weeks planned yet. Click \"Plan next week\" to get started.",
    generateShopping: "Generate shopping list",
  },
  weekBlock: {
    weather: "Weather",
    events: "Events",
    location: "Location",
    lunch: "Lunch",
    dinner: "Dinner",
    allDay: "All-Day",
    locationPlaceholder: "Add a note…",
    lunchPlaceholder: "Lunch… (type /recipe to search)",
    dinnerPlaceholder: "Dinner… (type /recipe to search)",
  },
  calendar: {
    title: "Calendar",
  },
  meals: {
    title: "Recipes",
    newRecipe: "New Recipe",
    allTypes: "All types",
    allDiets: "All diets",
    typeMeal: "Meal",
    typeSnack: "Snack",
    typeDrink: "Drink",
    typeBaked: "Baked",
    dietMeat: "Meat",
    dietFish: "Fish",
    dietVegetarian: "Vegetarian",
    officeFilter: "Office",
    quickFilter: "30min",
    noRecipesMatch: "No recipes match filters.",
    noRecipesYet: "No recipes yet. Add your first recipe.",
    aiImport: "AI Import",
    nameLabel: "Name *",
    typeLabel: "Type",
    dietLabel: "Diet",
    servingsLabel: "Servings",
    officeLabel: "Office",
    quickLabel: "Quick",
    notesLabel: "Notes",
    sourceLabel: "Source",
    ingredientsLabel: "Ingredients",
    stepsLabel: "Steps",
    ingredientsHint: "One ingredient per line.",
    stepsHint: "One step per line.",
    saveRecipe: "Save Recipe",
    savingRecipe: "Saving…",
    addPhoto: "Add a photo",
    insertRecipeOrUrl: "Insert recipe or URL here",
    import: "Import",
    importing: "Importing…",
  },
  tasks: {
    title: "Tasks",
    newTask: "New task",
    overdue: "Overdue",
    thisWeek: "This week",
    later: "Later",
    allMembers: "All members",
    noTasksDue: "No tasks due this week or overdue.",
    noTasksMatch: "No tasks match this filter.",
    taskNamePlaceholder: "Task name…",
    descriptionPlaceholder: "Optional details…",
    dueDateLabel: "Due date",
    assigneesLabel: "Assignees",
    nameRequired: "Name is required.",
    dueDateRequired: "Due date is required.",
    deleteTask: "Delete",
    deleting: "Deleting…",
  },
  shopping: {
    title: "Shopping",
    qty: "Qty",
    addItem: "Add item",
    other: "Other",
  },
  onboarding: {
    createFamily: "Create a family",
    joinFamily: "Join a family",
    creating: "Creating…",
    joining: "Joining…",
    familyNamePlaceholder: "Family name",
    cityPlaceholder: "City (for weather)",
    joinCodePlaceholder: "Join code",
  },
  settings: {
    title: "Settings",
    profile: "Profile",
    googleCalendar: "Google Calendar",
    location: "Location",
    family: "Family",
    shopping: "Shopping",
    language: "Language",
    profileDesc: "Your display name shown in the app.",
    profileNameLabel: "Name",
    profileNamePlaceholder: "Your name",
    locationDesc: "Your home city is used to show weather on the home screen.",
    homeCityLabel: "Home city",
    homeCityPlaceholder: "e.g. Berlin",
    save: "Save",
    saving: "Saving…",
    saved: "Saved!",
    cancel: "Cancel",
    loading: "Loading…",
    loadingCalendars: "Loading calendars…",
    retry: "Retry",
    remove: "Remove",
    confirmQuestion: "Confirm?",
    generate: "Generate",
    generating: "Generating…",
    addCalendar: "Add calendar",
    adding: "Adding…",
    importedCalendarsTitle: "Imported Calendars (iCal)",
    importedCalendarsDesc: "Add any calendar via its .ics URL — Google Calendar, Outlook, public feeds, etc.",
    noImportedCalendars: "No imported calendars yet.",
    noGoogleCalendars: "No Google calendars found in your account.",
    googleCalendarDesc: "Choose which of your Google Calendars to sync with YourKieke.",
    colorLabel: "Color",
    calendarNamePlaceholder: "Calendar name",
    familyNameLabel: "Family name",
    familyNamePlaceholder: "My Family",
    joinCodeLabel: "Join code",
    joinCodeDesc: "Share with family members to invite them.",
    membersTitle: "Members",
    membersDesc: "Admins can change roles and activate or deactivate accounts.",
    addMember: "+ Add Member",
    addMemberTitle: "Add Member",
    resetPassword: "Reset password",
    deactivate: "Deactivate",
    activate: "Activate",
    you: "you",
    categoriesTitle: "Categories",
    blacklistTitle: "Blacklist",
    blacklistDesc: "Terms excluded from auto-suggestions.",
    rename: "Rename",
    add: "Add",
    newCategoryPlaceholder: "New category…",
    newTermPlaceholder: "New term…",
    languageTitle: "Language",
    languageDesc: "Choose the display language for the app.",
    chooseLanguage: "Language",
    roleMember: "Member",
    roleParent: "Parent",
    roleAdmin: "Admin",
    newPasswordPlaceholder: "New password (min 8)",
    creating: "Creating…",
    nameLabel: "Name",
    usernameLabel: "Username",
    passwordLabel: "Password",
    failedSave: "Failed to save.",
  },
}

const es: Translations = {
  nav: {
    calendar: "Calendario",
    weekPlanner: "Planificador semanal",
    recipes: "Recetas",
    shopping: "Compras",
    tasks: "Tareas",
    settings: "Ajustes",
    signOut: "Cerrar sesión",
  },
  home: {
    welcomeTitle: "Bienvenido a YourKieke",
    welcomeSubtitle: "Tu centro familiar compartido.",
    signInWithGoogle: "Iniciar sesión con Google",
    or: "o",
    goodMorning: "Buenos días",
    goodAfternoon: "Buenas tardes",
    goodEvening: "Buenas noches",
    tasksThisWeek: "Tareas esta semana",
    allTasks: "→ Todas las tareas",
    noWeekYet: "Sin plan para esta semana.",
    goToWeekPlanning: "Ir al planificador →",
    previous: "Anterior",
    next: "Siguiente",
  },
  week: {
    title: "Planificador semanal",
    planNextWeek: "Planificar próxima semana",
    planning: "Planificando…",
    noWeeksYet: "Sin semanas planificadas. Haz clic en \"Planificar próxima semana\" para empezar.",
    generateShopping: "Generar lista de compras",
  },
  weekBlock: {
    weather: "Clima",
    events: "Eventos",
    location: "Ubicación",
    lunch: "Almuerzo",
    dinner: "Cena",
    allDay: "Todo el día",
    locationPlaceholder: "Añadir nota…",
    lunchPlaceholder: "Almuerzo… (escribe /receta para buscar)",
    dinnerPlaceholder: "Cena… (escribe /receta para buscar)",
  },
  calendar: {
    title: "Calendario",
  },
  meals: {
    title: "Recetas",
    newRecipe: "Nueva receta",
    allTypes: "Todos los tipos",
    allDiets: "Todas las dietas",
    typeMeal: "Comida",
    typeSnack: "Snack",
    typeDrink: "Bebida",
    typeBaked: "Horneado",
    dietMeat: "Carne",
    dietFish: "Pescado",
    dietVegetarian: "Vegetariano",
    officeFilter: "Oficina",
    quickFilter: "30min",
    noRecipesMatch: "No hay recetas que coincidan.",
    noRecipesYet: "Sin recetas aún. Añade tu primera receta.",
    aiImport: "Importar con IA",
    nameLabel: "Nombre *",
    typeLabel: "Tipo",
    dietLabel: "Dieta",
    servingsLabel: "Porciones",
    officeLabel: "Oficina",
    quickLabel: "Rápida",
    notesLabel: "Notas",
    sourceLabel: "Fuente",
    ingredientsLabel: "Ingredientes",
    stepsLabel: "Pasos",
    ingredientsHint: "Un ingrediente por línea.",
    stepsHint: "Un paso por línea.",
    saveRecipe: "Guardar receta",
    savingRecipe: "Guardando…",
    addPhoto: "Añadir foto",
    insertRecipeOrUrl: "Pega una receta o URL aquí",
    import: "Importar",
    importing: "Importando…",
  },
  tasks: {
    title: "Tareas",
    newTask: "Nueva tarea",
    overdue: "Atrasadas",
    thisWeek: "Esta semana",
    later: "Más adelante",
    allMembers: "Todos los miembros",
    noTasksDue: "Sin tareas pendientes esta semana.",
    noTasksMatch: "Sin tareas que coincidan.",
    taskNamePlaceholder: "Nombre de la tarea…",
    descriptionPlaceholder: "Detalles opcionales…",
    dueDateLabel: "Fecha límite",
    assigneesLabel: "Asignados",
    nameRequired: "El nombre es obligatorio.",
    dueDateRequired: "La fecha límite es obligatoria.",
    deleteTask: "Eliminar",
    deleting: "Eliminando…",
  },
  shopping: {
    title: "Compras",
    qty: "Cant.",
    addItem: "Añadir artículo",
    other: "Otros",
  },
  onboarding: {
    createFamily: "Crear una familia",
    joinFamily: "Unirse a una familia",
    creating: "Creando…",
    joining: "Uniéndose…",
    familyNamePlaceholder: "Nombre de la familia",
    cityPlaceholder: "Ciudad (para el tiempo)",
    joinCodePlaceholder: "Código de invitación",
  },
  settings: {
    title: "Ajustes",
    profile: "Perfil",
    googleCalendar: "Google Calendar",
    location: "Ubicación",
    family: "Familia",
    shopping: "Compras",
    language: "Idioma",
    profileDesc: "Tu nombre visible en la app.",
    profileNameLabel: "Nombre",
    profileNamePlaceholder: "Tu nombre",
    locationDesc: "Tu ciudad se usa para mostrar el tiempo en la pantalla de inicio.",
    homeCityLabel: "Ciudad de origen",
    homeCityPlaceholder: "p.ej. Madrid",
    save: "Guardar",
    saving: "Guardando…",
    saved: "¡Guardado!",
    cancel: "Cancelar",
    loading: "Cargando…",
    loadingCalendars: "Cargando calendarios…",
    retry: "Reintentar",
    remove: "Eliminar",
    confirmQuestion: "¿Confirmar?",
    generate: "Generar",
    generating: "Generando…",
    addCalendar: "Añadir calendario",
    adding: "Añadiendo…",
    importedCalendarsTitle: "Calendarios importados (iCal)",
    importedCalendarsDesc: "Añade cualquier calendario por su URL .ics.",
    noImportedCalendars: "Sin calendarios importados.",
    noGoogleCalendars: "No se encontraron calendarios de Google.",
    googleCalendarDesc: "Elige qué calendarios de Google sincronizar.",
    colorLabel: "Color",
    calendarNamePlaceholder: "Nombre del calendario",
    familyNameLabel: "Nombre de la familia",
    familyNamePlaceholder: "Mi Familia",
    joinCodeLabel: "Código de invitación",
    joinCodeDesc: "Comparte con miembros de la familia para invitarlos.",
    membersTitle: "Miembros",
    membersDesc: "Los administradores pueden cambiar roles y activar o desactivar cuentas.",
    addMember: "+ Añadir miembro",
    addMemberTitle: "Añadir miembro",
    resetPassword: "Restablecer contraseña",
    deactivate: "Desactivar",
    activate: "Activar",
    you: "tú",
    categoriesTitle: "Categorías",
    blacklistTitle: "Lista negra",
    blacklistDesc: "Términos excluidos de las sugerencias automáticas.",
    rename: "Renombrar",
    add: "Añadir",
    newCategoryPlaceholder: "Nueva categoría…",
    newTermPlaceholder: "Nuevo término…",
    languageTitle: "Idioma",
    languageDesc: "Elige el idioma de visualización.",
    chooseLanguage: "Idioma",
    roleMember: "Miembro",
    roleParent: "Padre/Madre",
    roleAdmin: "Admin",
    newPasswordPlaceholder: "Nueva contraseña (mín. 8)",
    creating: "Creando…",
    nameLabel: "Nombre",
    usernameLabel: "Usuario",
    passwordLabel: "Contraseña",
    failedSave: "Error al guardar.",
  },
}

const de: Translations = {
  nav: {
    calendar: "Kalender",
    weekPlanner: "Wochenplaner",
    recipes: "Rezepte",
    shopping: "Einkauf",
    tasks: "Aufgaben",
    settings: "Einstellungen",
    signOut: "Abmelden",
  },
  home: {
    welcomeTitle: "Willkommen bei YourKieke",
    welcomeSubtitle: "Euer gemeinsames Familien-Hub.",
    signInWithGoogle: "Mit Google anmelden",
    or: "oder",
    goodMorning: "Guten Morgen",
    goodAfternoon: "Guten Tag",
    goodEvening: "Guten Abend",
    tasksThisWeek: "Aufgaben diese Woche",
    allTasks: "→ Alle Aufgaben",
    noWeekYet: "Noch kein Plan für diese Woche.",
    goToWeekPlanning: "Zur Wochenplanung →",
    previous: "Zurück",
    next: "Weiter",
  },
  week: {
    title: "Wochenplaner",
    planNextWeek: "Nächste Woche planen",
    planning: "Plane…",
    noWeeksYet: "Noch keine Wochen geplant. Klicke auf \"Nächste Woche planen\" um zu beginnen.",
    generateShopping: "Einkaufsliste erstellen",
  },
  weekBlock: {
    weather: "Wetter",
    events: "Termine",
    location: "Ort",
    lunch: "Mittagessen",
    dinner: "Abendessen",
    allDay: "Ganztägig",
    locationPlaceholder: "Notiz hinzufügen…",
    lunchPlaceholder: "Mittagessen… (/rezept zum Suchen)",
    dinnerPlaceholder: "Abendessen… (/rezept zum Suchen)",
  },
  calendar: {
    title: "Kalender",
  },
  meals: {
    title: "Rezepte",
    newRecipe: "Neues Rezept",
    allTypes: "Alle Typen",
    allDiets: "Alle Diäten",
    typeMeal: "Mahlzeit",
    typeSnack: "Snack",
    typeDrink: "Getränk",
    typeBaked: "Gebacken",
    dietMeat: "Fleisch",
    dietFish: "Fisch",
    dietVegetarian: "Vegetarisch",
    officeFilter: "Büro",
    quickFilter: "30min",
    noRecipesMatch: "Keine Rezepte entsprechen den Filtern.",
    noRecipesYet: "Noch keine Rezepte. Füge dein erstes Rezept hinzu.",
    aiImport: "KI-Import",
    nameLabel: "Name *",
    typeLabel: "Typ",
    dietLabel: "Diät",
    servingsLabel: "Portionen",
    officeLabel: "Büro",
    quickLabel: "Schnell",
    notesLabel: "Notizen",
    sourceLabel: "Quelle",
    ingredientsLabel: "Zutaten",
    stepsLabel: "Schritte",
    ingredientsHint: "Eine Zutat pro Zeile.",
    stepsHint: "Ein Schritt pro Zeile.",
    saveRecipe: "Rezept speichern",
    savingRecipe: "Speichere…",
    addPhoto: "Foto hinzufügen",
    insertRecipeOrUrl: "Rezept oder URL einfügen",
    import: "Importieren",
    importing: "Importiere…",
  },
  tasks: {
    title: "Aufgaben",
    newTask: "Neue Aufgabe",
    overdue: "Überfällig",
    thisWeek: "Diese Woche",
    later: "Später",
    allMembers: "Alle Mitglieder",
    noTasksDue: "Keine Aufgaben diese Woche oder überfällig.",
    noTasksMatch: "Keine passenden Aufgaben.",
    taskNamePlaceholder: "Aufgabenname…",
    descriptionPlaceholder: "Optionale Details…",
    dueDateLabel: "Fälligkeitsdatum",
    assigneesLabel: "Zugewiesen an",
    nameRequired: "Name ist erforderlich.",
    dueDateRequired: "Fälligkeitsdatum ist erforderlich.",
    deleteTask: "Löschen",
    deleting: "Lösche…",
  },
  shopping: {
    title: "Einkauf",
    qty: "Menge",
    addItem: "Artikel hinzufügen",
    other: "Sonstiges",
  },
  onboarding: {
    createFamily: "Familie erstellen",
    joinFamily: "Familie beitreten",
    creating: "Erstelle…",
    joining: "Trete bei…",
    familyNamePlaceholder: "Familienname",
    cityPlaceholder: "Stadt (für Wetter)",
    joinCodePlaceholder: "Einladungscode",
  },
  settings: {
    title: "Einstellungen",
    profile: "Profil",
    googleCalendar: "Google Kalender",
    location: "Standort",
    family: "Familie",
    shopping: "Einkauf",
    language: "Sprache",
    profileDesc: "Dein Anzeigename in der App.",
    profileNameLabel: "Name",
    profileNamePlaceholder: "Dein Name",
    locationDesc: "Deine Heimatstadt wird für das Wetter auf dem Startbildschirm verwendet.",
    homeCityLabel: "Heimatstadt",
    homeCityPlaceholder: "z.B. Berlin",
    save: "Speichern",
    saving: "Speichere…",
    saved: "Gespeichert!",
    cancel: "Abbrechen",
    loading: "Lade…",
    loadingCalendars: "Lade Kalender…",
    retry: "Erneut versuchen",
    remove: "Entfernen",
    confirmQuestion: "Bestätigen?",
    generate: "Generieren",
    generating: "Generiere…",
    addCalendar: "Kalender hinzufügen",
    adding: "Füge hinzu…",
    importedCalendarsTitle: "Importierte Kalender (iCal)",
    importedCalendarsDesc: "Füge beliebige Kalender per .ics-URL hinzu.",
    noImportedCalendars: "Noch keine importierten Kalender.",
    noGoogleCalendars: "Keine Google-Kalender in deinem Konto gefunden.",
    googleCalendarDesc: "Wähle aus, welche Google-Kalender synchronisiert werden sollen.",
    colorLabel: "Farbe",
    calendarNamePlaceholder: "Kalendername",
    familyNameLabel: "Familienname",
    familyNamePlaceholder: "Meine Familie",
    joinCodeLabel: "Einladungscode",
    joinCodeDesc: "Teile den Code mit Familienmitgliedern.",
    membersTitle: "Mitglieder",
    membersDesc: "Admins können Rollen ändern und Konten aktivieren oder deaktivieren.",
    addMember: "+ Mitglied hinzufügen",
    addMemberTitle: "Mitglied hinzufügen",
    resetPassword: "Passwort zurücksetzen",
    deactivate: "Deaktivieren",
    activate: "Aktivieren",
    you: "du",
    categoriesTitle: "Kategorien",
    blacklistTitle: "Schwarze Liste",
    blacklistDesc: "Begriffe, die von automatischen Vorschlägen ausgeschlossen sind.",
    rename: "Umbenennen",
    add: "Hinzufügen",
    newCategoryPlaceholder: "Neue Kategorie…",
    newTermPlaceholder: "Neuer Begriff…",
    languageTitle: "Sprache",
    languageDesc: "Anzeigesprache der App wählen.",
    chooseLanguage: "Sprache",
    roleMember: "Mitglied",
    roleParent: "Elternteil",
    roleAdmin: "Admin",
    newPasswordPlaceholder: "Neues Passwort (min. 8)",
    creating: "Erstelle…",
    nameLabel: "Name",
    usernameLabel: "Benutzername",
    passwordLabel: "Passwort",
    failedSave: "Speichern fehlgeschlagen.",
  },
}

export const translations: Record<string, Translations> = { en, es, de }

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
}
