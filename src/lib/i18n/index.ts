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
    username: string
    password: string
    signingIn: string
    signIn: string
    invalidCredentials: string
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
    dayView: string
    threeDayView: string
    weekView: string
    addToShoppingList: string
    adding: string
    close: string
    withUs: string
    withMona: string
    searchMeals: string
    viewRecipe: string
  }
  calendar: {
    title: string
    signInRequired: string
    today: string
    updating: string
    showLabel: string
    filterCustody: string
    filterGoogle: string
    filterImported: string
    noCalendarsSelected: string
    goToSettings: string
    toChooseCalendars: string
    couldNotLoad: string
    retry: string
    close: string
    allDay: string
    custodyModalTitle: string
    firstNight: string
    sleepsAt: string
    withUs: string
    elsewhere: string
    recurring: string
    alternatingWeeks: string
    until: string
    weeksOfSchedulePrefix: string
    weeksOfScheduleSuffix: string
    conflictWarning: string
    cancel: string
    overwrite: string
    saveSchedule: string
  }
  meals: {
    title: string
    newRecipe: string
    backLink: string
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
    notesPlaceholder: string
    sourceLabel: string
    sourcePlaceholder: string
    ingredientsLabel: string
    stepsLabel: string
    preparationSteps: string
    ingredientsHint: string
    stepsHint: string
    saveRecipe: string
    savingRecipe: string
    addPhoto: string
    uploading: string
    change: string
    remove: string
    insertRecipeOrUrl: string
    import: string
    importing: string
    notFound: string
    deleting: string
    deleteConfirm: string
    delete: string
    notesEmptyPrompt: string
    sourceEmptyPrompt: string
    ingredientsEmptyPrompt: string
    stepsEmptyPrompt: string
    batchImport: string
    batchHint: string
    batchPlaceholder: string
    batchItemDetected: string
    batchItemsDetected: string
    importAll: string
    batchImporting: string
    batchDoneAll: string
    batchDoneMixed: string
  }
  taskModal: {
    editTitle: string
    newTitle: string
    nameLabel: string
    namePlaceholder: string
    descriptionLabel: string
    descriptionPlaceholder: string
    dueDateLabel: string
    assigneesLabel: string
    nameRequired: string
    dueDateRequired: string
    failedDelete: string
    failedSave: string
    deleting: string
    delete: string
    cancel: string
    saving: string
    save: string
    deleteConfirm: string
  }
  tasks: {
    title: string
    newTask: string
    overdue: string
    thisWeek: string
    later: string
    done: string
    allMembers: string
    showCompleted: string
    noOpenTasks: string
    noTasksYet: string
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
    addItemPlaceholder: string
    categoryPlaceholder: string
    add: string
    noItems: string
    other: string
    changeCategory: string
    removeItem: string
    clearList: string
    failedToAdd: string
  }
  onboarding: {
    welcomeTitle: string
    welcomeSubtitle: string
    createFamilyLabel: string
    createFamilyDesc: string
    joinFamilyLabel: string
    joinFamilyDesc: string
    back: string
    createTitle: string
    createSubtitle: string
    familyNameLabel: string
    optional: string
    familyNamePlaceholder: string
    homeCityLabel: string
    cityPlaceholder: string
    cityHint: string
    creating: string
    createButton: string
    joinTitle: string
    joinSubtitle: string
    joinCodeLabel: string
    joining: string
    joinButton: string
    isReady: string
    shareCodeSubtitle: string
    codeHint: string
    goHome: string
    errorInvalidCode: string
    errorGeneric: string
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
    failedSaveRetry: string
    minChars: string
    copyCode: string
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
    username: "Username",
    password: "Password",
    signingIn: "Signing in…",
    signIn: "Sign in",
    invalidCredentials: "Invalid username or password",
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
    dayView: "Day",
    threeDayView: "3 Days",
    weekView: "Week",
    addToShoppingList: "Add to shopping list",
    adding: "Adding…",
    close: "Close",
    withUs: "With us",
    withMona: "With Mona",
    searchMeals: "Search meals…",
    viewRecipe: "View recipe",
  },
  calendar: {
    title: "Calendar",
    signInRequired: "Please sign in to view the calendar.",
    today: "Today",
    updating: "Updating…",
    showLabel: "Show:",
    filterCustody: "Custody",
    filterGoogle: "Google Calendars",
    filterImported: "Imported",
    noCalendarsSelected: "No Google calendars selected.",
    goToSettings: "Go to Settings →",
    toChooseCalendars: "to choose which calendars to sync.",
    couldNotLoad: "Could not load Google Calendar events:",
    retry: "Retry",
    close: "Close",
    allDay: "All day",
    custodyModalTitle: "Add Custody Schedule",
    firstNight: "First night",
    sleepsAt: "Emilia sleeps at",
    withUs: "With us",
    elsewhere: "Elsewhere",
    recurring: "Recurring",
    alternatingWeeks: "Alternating weeks · switches on Sunday",
    until: "Until",
    weeksOfSchedulePrefix: "Creates ~",
    weeksOfScheduleSuffix: "weeks of schedule entries",
    conflictWarning: "There are already entries for these dates. Submit again to overwrite them.",
    cancel: "Cancel",
    overwrite: "Overwrite",
    saveSchedule: "Save Schedule",
  },
  meals: {
    title: "Recipes",
    newRecipe: "New Recipe",
    backLink: "Recipes",
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
    notesPlaceholder: "Any notes…",
    sourceLabel: "Source",
    sourcePlaceholder: "URL or book / person name",
    ingredientsLabel: "Ingredients",
    stepsLabel: "Steps",
    preparationSteps: "Preparation Steps",
    ingredientsHint: "One ingredient per line.",
    stepsHint: "One step per line.",
    saveRecipe: "Save Recipe",
    savingRecipe: "Saving…",
    addPhoto: "Add a photo",
    uploading: "Uploading…",
    change: "Change",
    remove: "Remove",
    insertRecipeOrUrl: "Insert recipe or URL here",
    import: "Import",
    importing: "Importing…",
    notFound: "Recipe not found.",
    deleting: "Deleting…",
    deleteConfirm: "Sure? Click to confirm",
    delete: "Delete",
    notesEmptyPrompt: "Click to add notes…",
    sourceEmptyPrompt: "Click to add source…",
    ingredientsEmptyPrompt: "Click to add ingredients…",
    stepsEmptyPrompt: "Click to add steps…",
    batchImport: "Batch import",
    batchHint: "One URL per line, or separate recipe texts with ---",
    batchPlaceholder: "https://example.com/pasta\nhttps://example.com/soup\n---\nBanana Bread\n\nIngredients:\n3 ripe bananas…",
    batchItemDetected: "1 item detected",
    batchItemsDetected: "{n} items detected",
    importAll: "Import all",
    batchImporting: "Importing… {current} / {total}",
    batchDoneAll: "All {total} imported",
    batchDoneMixed: "{imported} imported, {failed} failed",
  },
  taskModal: {
    editTitle: "Edit task",
    newTitle: "New task",
    nameLabel: "Name *",
    namePlaceholder: "Task name",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Optional details…",
    dueDateLabel: "Due date *",
    assigneesLabel: "Assignees",
    nameRequired: "Name is required",
    dueDateRequired: "Due date is required",
    failedDelete: "Failed to delete",
    failedSave: "Failed to save",
    deleting: "Deleting…",
    delete: "Delete",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save",
    deleteConfirm: "Delete this task?",
  },
  tasks: {
    title: "Tasks",
    newTask: "New task",
    overdue: "Overdue",
    thisWeek: "This week",
    later: "Later",
    done: "Done",
    allMembers: "All members",
    showCompleted: "Show completed",
    noOpenTasks: "No open tasks.",
    noTasksYet: "No tasks yet. Create one to get started.",
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
    title: "Shopping List",
    qty: "Qty",
    addItemPlaceholder: "Add item…",
    categoryPlaceholder: "Category…",
    add: "Add",
    noItems: "No items yet. Add something above.",
    other: "Other",
    changeCategory: "Change category",
    removeItem: "Remove item",
    clearList: "Clear list",
    failedToAdd: "Failed to add item",
  },
  onboarding: {
    welcomeTitle: "Welcome to YourKieke",
    welcomeSubtitle: "Do you want to create a new family or join an existing one?",
    createFamilyLabel: "Create a family",
    createFamilyDesc: "Set up a new family space and invite members",
    joinFamilyLabel: "Join a family",
    joinFamilyDesc: "Enter a join code shared by a family member",
    back: "← Back",
    createTitle: "Create your family",
    createSubtitle: "Give your family a name and set your home location.",
    familyNameLabel: "Family name",
    optional: "(optional)",
    familyNamePlaceholder: "e.g. The Smiths",
    homeCityLabel: "Home city",
    cityPlaceholder: "e.g. Berlin",
    cityHint: "Used for weather on the home screen.",
    creating: "Creating…",
    createButton: "Create family",
    joinTitle: "Join a family",
    joinSubtitle: "Enter the 10-digit code shared with you by your family.",
    joinCodeLabel: "Join code",
    joining: "Joining…",
    joinButton: "Join family",
    isReady: "is ready",
    shareCodeSubtitle: "Share this code with your family members so they can join.",
    codeHint: "Anyone with this code can join your family. You can also find it later in Settings.",
    goHome: "Go to home →",
    errorInvalidCode: "That code doesn't match any family. Check for typos.",
    errorGeneric: "Something went wrong. Please try again.",
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
    failedSaveRetry: "Failed to save. Please try again.",
    minChars: "Min. 8 characters",
    copyCode: "Copy code",
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
    username: "Usuario",
    password: "Contraseña",
    signingIn: "Iniciando sesión…",
    signIn: "Iniciar sesión",
    invalidCredentials: "Usuario o contraseña incorrectos",
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
    lunchPlaceholder: "Almuerzo…",
    dinnerPlaceholder: "Cena…",
    dayView: "Día",
    threeDayView: "3 Días",
    weekView: "Semana",
    addToShoppingList: "Añadir a la lista de compras",
    adding: "Añadiendo…",
    close: "Cerrar",
    withUs: "Con nosotros",
    withMona: "Con Mona",
    searchMeals: "Buscar recetas…",
    viewRecipe: "Ver receta",
  },
  calendar: {
    title: "Calendario",
    signInRequired: "Inicia sesión para ver el calendario.",
    today: "Hoy",
    updating: "Actualizando…",
    showLabel: "Mostrar:",
    filterCustody: "Custodia",
    filterGoogle: "Google Calendarios",
    filterImported: "Importados",
    noCalendarsSelected: "Sin calendarios de Google seleccionados.",
    goToSettings: "Ir a Ajustes →",
    toChooseCalendars: "para elegir qué calendarios sincronizar.",
    couldNotLoad: "No se pudieron cargar los eventos de Google Calendar:",
    retry: "Reintentar",
    close: "Cerrar",
    allDay: "Todo el día",
    custodyModalTitle: "Añadir horario de custodia",
    firstNight: "Primera noche",
    sleepsAt: "Emilia duerme en",
    withUs: "Con nosotros",
    elsewhere: "En otro lugar",
    recurring: "Recurrente",
    alternatingWeeks: "Semanas alternas · cambia los domingos",
    until: "Hasta",
    weeksOfSchedulePrefix: "Crea ~",
    weeksOfScheduleSuffix: "semanas de entradas",
    conflictWarning: "Ya hay entradas para estas fechas. Envía de nuevo para sobreescribirlas.",
    cancel: "Cancelar",
    overwrite: "Sobreescribir",
    saveSchedule: "Guardar horario",
  },
  meals: {
    title: "Recetas",
    newRecipe: "Nueva receta",
    backLink: "Recetas",
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
    notesPlaceholder: "Cualquier nota…",
    sourceLabel: "Fuente",
    sourcePlaceholder: "URL o nombre del libro / persona",
    ingredientsLabel: "Ingredientes",
    stepsLabel: "Pasos",
    preparationSteps: "Pasos de preparación",
    ingredientsHint: "Un ingrediente por línea.",
    stepsHint: "Un paso por línea.",
    saveRecipe: "Guardar receta",
    savingRecipe: "Guardando…",
    addPhoto: "Añadir foto",
    uploading: "Subiendo…",
    change: "Cambiar",
    remove: "Eliminar",
    insertRecipeOrUrl: "Pega una receta o URL aquí",
    import: "Importar",
    importing: "Importando…",
    notFound: "Receta no encontrada.",
    deleting: "Eliminando…",
    deleteConfirm: "¿Seguro? Haz clic para confirmar",
    delete: "Eliminar",
    notesEmptyPrompt: "Haz clic para añadir notas…",
    sourceEmptyPrompt: "Haz clic para añadir fuente…",
    ingredientsEmptyPrompt: "Haz clic para añadir ingredientes…",
    stepsEmptyPrompt: "Haz clic para añadir pasos…",
    batchImport: "Importación masiva",
    batchHint: "Una URL por línea, o separa recetas completas con ---",
    batchPlaceholder: "https://example.com/pasta\nhttps://example.com/sopa\n---\nPan de plátano\n\nIngredientes:\n3 plátanos maduros…",
    batchItemDetected: "1 elemento detectado",
    batchItemsDetected: "{n} elementos detectados",
    importAll: "Importar todo",
    batchImporting: "Importando… {current} / {total}",
    batchDoneAll: "{total} importados",
    batchDoneMixed: "{imported} importados, {failed} fallidos",
  },
  taskModal: {
    editTitle: "Editar tarea",
    newTitle: "Nueva tarea",
    nameLabel: "Nombre *",
    namePlaceholder: "Nombre de la tarea",
    descriptionLabel: "Descripción",
    descriptionPlaceholder: "Detalles opcionales…",
    dueDateLabel: "Fecha límite *",
    assigneesLabel: "Asignados",
    nameRequired: "El nombre es obligatorio",
    dueDateRequired: "La fecha límite es obligatoria",
    failedDelete: "Error al eliminar",
    failedSave: "Error al guardar",
    deleting: "Eliminando…",
    delete: "Eliminar",
    cancel: "Cancelar",
    saving: "Guardando…",
    save: "Guardar",
    deleteConfirm: "¿Eliminar esta tarea?",
  },
  tasks: {
    title: "Tareas",
    newTask: "Nueva tarea",
    overdue: "Atrasadas",
    thisWeek: "Esta semana",
    later: "Más adelante",
    done: "Hechas",
    allMembers: "Todos los miembros",
    showCompleted: "Mostrar completadas",
    noOpenTasks: "Sin tareas abiertas.",
    noTasksYet: "Sin tareas aún. Crea una para empezar.",
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
    title: "Lista de compras",
    qty: "Cant.",
    addItemPlaceholder: "Añadir artículo…",
    categoryPlaceholder: "Categoría…",
    add: "Añadir",
    noItems: "Sin artículos. Añade algo arriba.",
    other: "Otros",
    changeCategory: "Cambiar categoría",
    removeItem: "Eliminar artículo",
    clearList: "Limpiar lista",
    failedToAdd: "Error al añadir artículo",
  },
  onboarding: {
    welcomeTitle: "Bienvenido a YourKieke",
    welcomeSubtitle: "¿Quieres crear una nueva familia o unirte a una existente?",
    createFamilyLabel: "Crear una familia",
    createFamilyDesc: "Crea un nuevo espacio familiar e invita miembros",
    joinFamilyLabel: "Unirse a una familia",
    joinFamilyDesc: "Introduce el código compartido por un familiar",
    back: "← Atrás",
    createTitle: "Crea tu familia",
    createSubtitle: "Dale un nombre a tu familia y establece tu ubicación.",
    familyNameLabel: "Nombre de la familia",
    optional: "(opcional)",
    familyNamePlaceholder: "p.ej. Los García",
    homeCityLabel: "Ciudad de origen",
    cityPlaceholder: "p.ej. Madrid",
    cityHint: "Se usa para mostrar el tiempo en la pantalla de inicio.",
    creating: "Creando…",
    createButton: "Crear familia",
    joinTitle: "Unirse a una familia",
    joinSubtitle: "Introduce el código de 10 dígitos compartido por tu familia.",
    joinCodeLabel: "Código de invitación",
    joining: "Uniéndose…",
    joinButton: "Unirse a la familia",
    isReady: "está lista",
    shareCodeSubtitle: "Comparte este código con tus familiares para que puedan unirse.",
    codeHint: "Cualquiera con este código puede unirse a tu familia. También puedes encontrarlo en Ajustes.",
    goHome: "Ir al inicio →",
    errorInvalidCode: "Ese código no coincide con ninguna familia. Revisa si hay errores.",
    errorGeneric: "Algo salió mal. Por favor, inténtalo de nuevo.",
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
    failedSaveRetry: "Error al guardar. Inténtalo de nuevo.",
    minChars: "Mín. 8 caracteres",
    copyCode: "Copiar código",
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
    username: "Benutzername",
    password: "Passwort",
    signingIn: "Anmelden…",
    signIn: "Anmelden",
    invalidCredentials: "Benutzername oder Passwort falsch",
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
    lunchPlaceholder: "Mittagessen…",
    dinnerPlaceholder: "Abendessen…",
    dayView: "Tag",
    threeDayView: "3 Tage",
    weekView: "Woche",
    addToShoppingList: "Zur Einkaufsliste hinzufügen",
    adding: "Füge hinzu…",
    close: "Schließen",
    withUs: "Bei uns",
    withMona: "Bei Mona",
    searchMeals: "Rezepte suchen…",
    viewRecipe: "Rezept ansehen",
  },
  calendar: {
    title: "Kalender",
    signInRequired: "Bitte anmelden, um den Kalender zu sehen.",
    today: "Heute",
    updating: "Aktualisiere…",
    showLabel: "Anzeigen:",
    filterCustody: "Sorgerecht",
    filterGoogle: "Google Kalender",
    filterImported: "Importiert",
    noCalendarsSelected: "Keine Google-Kalender ausgewählt.",
    goToSettings: "Zu Einstellungen →",
    toChooseCalendars: "um zu wählen, welche Kalender synchronisiert werden sollen.",
    couldNotLoad: "Google-Kalender-Ereignisse konnten nicht geladen werden:",
    retry: "Erneut versuchen",
    close: "Schließen",
    allDay: "Ganztägig",
    custodyModalTitle: "Sorgerechtszeitplan hinzufügen",
    firstNight: "Erste Nacht",
    sleepsAt: "Emilia schläft bei",
    withUs: "Bei uns",
    elsewhere: "Woanders",
    recurring: "Wiederkehrend",
    alternatingWeeks: "Alternierende Wochen · wechselt sonntags",
    until: "Bis",
    weeksOfSchedulePrefix: "Erstellt ~",
    weeksOfScheduleSuffix: "Wochen Einträge",
    conflictWarning: "Für diese Daten gibt es bereits Einträge. Erneut absenden zum Überschreiben.",
    cancel: "Abbrechen",
    overwrite: "Überschreiben",
    saveSchedule: "Zeitplan speichern",
  },
  meals: {
    title: "Rezepte",
    newRecipe: "Neues Rezept",
    backLink: "Rezepte",
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
    notesPlaceholder: "Beliebige Notizen…",
    sourceLabel: "Quelle",
    sourcePlaceholder: "URL oder Buch- / Personenname",
    ingredientsLabel: "Zutaten",
    stepsLabel: "Schritte",
    preparationSteps: "Zubereitungsschritte",
    ingredientsHint: "Eine Zutat pro Zeile.",
    stepsHint: "Ein Schritt pro Zeile.",
    saveRecipe: "Rezept speichern",
    savingRecipe: "Speichere…",
    addPhoto: "Foto hinzufügen",
    uploading: "Lade hoch…",
    change: "Ändern",
    remove: "Entfernen",
    insertRecipeOrUrl: "Rezept oder URL einfügen",
    import: "Importieren",
    importing: "Importiere…",
    notFound: "Rezept nicht gefunden.",
    deleting: "Lösche…",
    deleteConfirm: "Sicher? Klicken zum Bestätigen",
    delete: "Löschen",
    notesEmptyPrompt: "Klicken um Notizen hinzuzufügen…",
    sourceEmptyPrompt: "Klicken um Quelle hinzuzufügen…",
    ingredientsEmptyPrompt: "Klicken um Zutaten hinzuzufügen…",
    stepsEmptyPrompt: "Klicken um Schritte hinzuzufügen…",
    batchImport: "Stapelimport",
    batchHint: "Eine URL pro Zeile oder Rezepte mit --- trennen",
    batchPlaceholder: "https://example.com/pasta\nhttps://example.com/suppe\n---\nBananenbrot\n\nZutaten:\n3 reife Bananen…",
    batchItemDetected: "1 Element erkannt",
    batchItemsDetected: "{n} Elemente erkannt",
    importAll: "Alle importieren",
    batchImporting: "Importiere… {current} / {total}",
    batchDoneAll: "Alle {total} importiert",
    batchDoneMixed: "{imported} importiert, {failed} fehlgeschlagen",
  },
  taskModal: {
    editTitle: "Aufgabe bearbeiten",
    newTitle: "Neue Aufgabe",
    nameLabel: "Name *",
    namePlaceholder: "Aufgabenname",
    descriptionLabel: "Beschreibung",
    descriptionPlaceholder: "Optionale Details…",
    dueDateLabel: "Fälligkeitsdatum *",
    assigneesLabel: "Zugewiesen an",
    nameRequired: "Name ist erforderlich",
    dueDateRequired: "Fälligkeitsdatum ist erforderlich",
    failedDelete: "Löschen fehlgeschlagen",
    failedSave: "Speichern fehlgeschlagen",
    deleting: "Lösche…",
    delete: "Löschen",
    cancel: "Abbrechen",
    saving: "Speichere…",
    save: "Speichern",
    deleteConfirm: "Diese Aufgabe löschen?",
  },
  tasks: {
    title: "Aufgaben",
    newTask: "Neue Aufgabe",
    overdue: "Überfällig",
    thisWeek: "Diese Woche",
    later: "Später",
    done: "Erledigt",
    allMembers: "Alle Mitglieder",
    showCompleted: "Erledigte anzeigen",
    noOpenTasks: "Keine offenen Aufgaben.",
    noTasksYet: "Noch keine Aufgaben. Erstelle eine zum Starten.",
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
    title: "Einkaufsliste",
    qty: "Menge",
    addItemPlaceholder: "Artikel hinzufügen…",
    categoryPlaceholder: "Kategorie…",
    add: "Hinzufügen",
    noItems: "Noch keine Artikel. Füge oben etwas hinzu.",
    other: "Sonstiges",
    changeCategory: "Kategorie ändern",
    removeItem: "Artikel entfernen",
    clearList: "Liste leeren",
    failedToAdd: "Artikel konnte nicht hinzugefügt werden",
  },
  onboarding: {
    welcomeTitle: "Willkommen bei YourKieke",
    welcomeSubtitle: "Möchtest du eine neue Familie erstellen oder einer bestehenden beitreten?",
    createFamilyLabel: "Familie erstellen",
    createFamilyDesc: "Richte einen neuen Familienbereich ein und lade Mitglieder ein",
    joinFamilyLabel: "Familie beitreten",
    joinFamilyDesc: "Gib einen Einladungscode eines Familienmitglieds ein",
    back: "← Zurück",
    createTitle: "Deine Familie erstellen",
    createSubtitle: "Gib deiner Familie einen Namen und lege deinen Heimatort fest.",
    familyNameLabel: "Familienname",
    optional: "(optional)",
    familyNamePlaceholder: "z.B. Die Müllers",
    homeCityLabel: "Heimatstadt",
    cityPlaceholder: "z.B. Berlin",
    cityHint: "Wird für das Wetter auf dem Startbildschirm verwendet.",
    creating: "Erstelle…",
    createButton: "Familie erstellen",
    joinTitle: "Familie beitreten",
    joinSubtitle: "Gib den 10-stelligen Code ein, den deine Familie mit dir geteilt hat.",
    joinCodeLabel: "Einladungscode",
    joining: "Trete bei…",
    joinButton: "Familie beitreten",
    isReady: "ist bereit",
    shareCodeSubtitle: "Teile diesen Code mit deinen Familienmitgliedern, damit sie beitreten können.",
    codeHint: "Jeder mit diesem Code kann deiner Familie beitreten. Du findest ihn auch später in den Einstellungen.",
    goHome: "Zur Startseite →",
    errorInvalidCode: "Dieser Code passt zu keiner Familie. Überprüfe auf Tippfehler.",
    errorGeneric: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
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
    failedSaveRetry: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    minChars: "Mind. 8 Zeichen",
    copyCode: "Code kopieren",
  },
}

export const translations: Record<string, Translations> = { en, es, de }

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
}
