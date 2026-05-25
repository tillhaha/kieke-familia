# Recipe Public Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every recipe publicly viewable at its existing `/meals/[id]` URL while restricting editing controls to authenticated family members.

**Architecture:** Remove auth from the GET handler in the meals API, then add `useSession` to the meal detail page and gate all editing controls behind an `isOwner` flag computed from the session. No schema changes, no new routes.

**Tech Stack:** Next.js 16, next-auth, Prisma, TypeScript, React

---

## Files Changed

| File | Change |
|---|---|
| `src/app/api/meals/[id]/route.ts` | Remove session/familyId guard from GET handler only |
| `src/app/meals/[id]/page.tsx` | Add `useSession`, `isOwner` flag, gate all editing controls |

---

### Task 1: Open up GET /api/meals/[id]

**Files:**
- Modify: `src/app/api/meals/[id]/route.ts:14-31`

- [ ] **Step 1: Remove auth guard from GET handler**

  Open `src/app/api/meals/[id]/route.ts`. The GET handler currently starts at line 14. Delete lines 15–18 (the session + familyId block):

  ```ts
  // DELETE these 4 lines from the GET handler:
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  ```

- [ ] **Step 2: Replace getAuthedMeal with an auth-free lookup**

  Still in the GET handler, the `try` block calls `getAuthedMeal(id, familyId)`. Replace that call only — do not touch the `getAuthedMeal` function itself (PATCH and DELETE still use it):

  ```ts
  // BEFORE (inside the try block):
  const meal = await getAuthedMeal(id, familyId)

  // AFTER:
  const meal = await prisma.meal.findFirst({ where: { id } })
  ```

  The GET handler after both changes should look like:

  ```ts
  export async function GET(_req: Request, { params }: Params) {
    const { id } = await params

    try {
      const meal = await prisma.meal.findFirst({ where: { id } })
      if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

      return NextResponse.json({ meal })
    } catch (err) {
      console.error("[GET /api/meals/:id]", err)
      return NextResponse.json({ error: "Failed to fetch meal" }, { status: 500 })
    }
  }
  ```

  Note: `getServerSession`, `authOptions` imports are still needed by PATCH and DELETE — do not remove them.

- [ ] **Step 3: Verify endpoint is open**

  Start the dev server (`npm run dev`) and in a separate terminal run:

  ```bash
  # Replace <some-meal-id> with a real meal ID from your DB (check /meals list)
  curl http://localhost:3000/api/meals/<some-meal-id>
  ```

  Expected: `{"meal": {...}}` with status 200 — no 401 or 403.

  Also verify PATCH still requires auth:

  ```bash
  curl -X PATCH http://localhost:3000/api/meals/<some-meal-id> \
    -H "Content-Type: application/json" \
    -d '{"name": "hacked"}'
  ```

  Expected: `{"error": "Unauthorized"}` with status 401.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/meals/[id]/route.ts
  git commit -m "feat: open GET /api/meals/[id] to unauthenticated requests"
  ```

---

### Task 2: Add session and ownership to the page

**Files:**
- Modify: `src/app/meals/[id]/page.tsx:1-41`

- [ ] **Step 1: Import useSession**

  At the top of `src/app/meals/[id]/page.tsx`, add the `useSession` import. The existing imports are on lines 1–10. Add after line 5 (`import { useParams, useRouter } from "next/navigation"`):

  ```ts
  import { useSession } from "next-auth/react"
  ```

- [ ] **Step 2: Add familyId to the Meal type**

  The `Meal` type is defined at lines 15–29. Add `familyId: string` as a field:

  ```ts
  type Meal = {
    id: string
    familyId: string   // add this line
    name: string
    mealType: MealType
    diet: Diet
    notes: string | null
    servings: number
    officeFriendly: boolean
    thirtyMinute: boolean
    favorite: boolean
    ingredients: string[]
    steps: string[]
    imageUrl: string | null
    source: string | null
  }
  ```

- [ ] **Step 3: Add useSession hook and isOwner flag**

  Inside `MealDetailPage`, directly after the existing `const [imageError, setImageError] = useState<string | null>(null)` line (around line 67), add:

  ```ts
  const { data: session, status } = useSession()
  const isOwner = status === "authenticated" && (session?.user as any)?.familyId === meal?.familyId
  ```

  Note: the `session.user` type in this project is extended with `familyId` via `as any` — see other components like `Navbar.tsx` for the pattern.

- [ ] **Step 4: Add confirmDelete reset effect**

  After the `isOwner` line, add:

  ```ts
  useEffect(() => {
    if (!isOwner) setConfirmDelete(false)
  }, [isOwner])
  ```

- [ ] **Step 5: Verify no TypeScript errors**

  ```bash
  npx tsc --noEmit 2>&1 | grep "meals/\[id\]"
  ```

  Expected: no output (no errors in this file).

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/meals/[id]/page.tsx
  git commit -m "feat: add session + isOwner flag to meal detail page"
  ```

---

### Task 3: Gate header and image controls

**Files:**
- Modify: `src/app/meals/[id]/page.tsx:242-295` (render section)

The render block starts after `if (!meal) return null` (line 240). Gate these elements:

- [ ] **Step 1: Gate recipe name — input vs h1**

  The name `<input>` is at line 249. Wrap it with `isOwner`:

  ```tsx
  {isOwner ? (
    <input
      className={styles.titleInput}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={handleNameBlur}
    />
  ) : (
    <h1 className={styles.titleInput}>{name}</h1>
  )}
  ```

  Use the same `styles.titleInput` class on the `<h1>` so spacing is preserved.

- [ ] **Step 2: Gate star and delete buttons**

  The star button and delete button are in `detailHeaderActions` (lines 255–269). Wrap both in `{isOwner && (...)}`:

  ```tsx
  <div className={styles.detailHeaderActions}>
    {isOwner && (
      <button
        className={`${styles.detailStarBtn} ${favorite ? styles.detailStarBtnActive : ""}`}
        onClick={handleFavoriteToggle}
        title={favorite ? "Remove from favourites" : "Add to favourites"}
      >
        <Star size={18} fill={favorite ? "currentColor" : "none"} strokeWidth={1.5} />
      </button>
    )}
    {isOwner && (
      <button
        className={confirmDelete ? styles.deleteBtnConfirm : styles.deleteBtn}
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? t.meals.deleting : confirmDelete ? t.meals.deleteConfirm : t.meals.delete}
      </button>
    )}
  </div>
  ```

- [ ] **Step 3: Gate image controls**

  In the `imageBlock` section (lines 274–293):

  - When `meal.imageUrl` exists: hide the `imageActions` overlay for non-owners:
    ```tsx
    {meal.imageUrl ? (
      <>
        <img key={meal.imageUrl} src={meal.imageUrl} alt={meal.name} className={styles.recipeImage} />
        {isOwner && (
          <div className={styles.imageActions}>
            <button className={styles.imageActionBtn} onClick={() => fileInputRef.current?.click()} disabled={imageUploading}>
              <Pencil size={11} /> {t.meals.change}
            </button>
            <button className={styles.imageActionBtn} onClick={handleImageRemove} disabled={imageUploading}>
              <Trash2 size={11} /> {t.meals.remove}
            </button>
          </div>
        )}
      </>
    ) : (
      // no image — see step below
    )}
    ```

  - When no image: remove `onClick` from placeholder for non-owners:
    ```tsx
    ) : (
      <div
        className={styles.imagePlaceholder}
        onClick={isOwner ? () => fileInputRef.current?.click() : undefined}
        style={isOwner ? undefined : { cursor: "default" }}
      >
        <ImagePlus size={22} strokeWidth={1.5} />
        <span className={styles.imagePlaceholderText}>{imageUploading ? t.meals.uploading : t.meals.addPhoto}</span>
      </div>
    )}
    ```

  The hidden `<input type="file">` at line 273 stays rendered unconditionally — it is invisible and harmless.

- [ ] **Step 4: Verify in browser**

  Visit a recipe URL while logged out (open incognito / private window). Confirm:
  - Recipe name renders as text, not an editable input
  - No star, delete, or image action buttons visible
  - Image placeholder is not clickable

  Then log in as the recipe's family member and confirm all controls reappear.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/meals/[id]/page.tsx
  git commit -m "feat: gate name, star, delete, and image controls on isOwner"
  ```

---

### Task 4: Gate meta fields and editable text sections

**Files:**
- Modify: `src/app/meals/[id]/page.tsx:297-455` (metaRow and fieldSection blocks)

- [ ] **Step 1: Gate meal type and diet selects**

  The `typeSelect` for meal type is at lines 300–310, diet at 315–323. Replace each with an owner/non-owner conditional. For non-owners, render the current value as a plain text badge using the same label style as other badges in the app:

  ```tsx
  {/* Meal type */}
  <div className={styles.metaField}>
    <span className={styles.metaLabel}>{t.meals.typeLabel}</span>
    {isOwner ? (
      <select
        className={styles.typeSelect}
        value={mealType}
        onChange={(e) => handleMealTypeChange(e.target.value as MealType | "")}
      >
        <option value="" disabled> </option>
        <option value="Meal">{t.meals.typeMeal}</option>
        <option value="Snack">{t.meals.typeSnack}</option>
        <option value="Drink">{t.meals.typeDrink}</option>
        <option value="Baked">{t.meals.typeBaked}</option>
      </select>
    ) : (
      <span className={styles.typeSelect}>{mealType}</span>
    )}
  </div>

  {/* Diet */}
  <div className={styles.metaField}>
    <span className={styles.metaLabel}>{t.meals.dietLabel}</span>
    {isOwner ? (
      <select
        className={styles.typeSelect}
        value={diet}
        onChange={(e) => handleDietChange(e.target.value as Diet)}
      >
        <option value="Meat">{t.meals.dietMeat}</option>
        <option value="Fish">{t.meals.dietFish}</option>
        <option value="Vegetarian">{t.meals.dietVegetarian}</option>
      </select>
    ) : (
      <span className={styles.typeSelect}>{diet}</span>
    )}
  </div>
  ```

- [ ] **Step 2: Gate servings input**

  The servings `<input>` is at lines 328–335:

  ```tsx
  <div className={styles.metaField}>
    <span className={styles.metaLabel}>{t.meals.servingsLabel}</span>
    {isOwner ? (
      <input
        type="text"
        inputMode="numeric"
        className={styles.servingsInput}
        value={servings}
        onChange={(e) => setServings(e.target.value)}
        onBlur={handleServingsBlur}
      />
    ) : (
      <span className={styles.servingsInput}>{servings}</span>
    )}
  </div>
  ```

- [ ] **Step 3: Gate toggle checkboxes**

  The office-friendly and 30-min checkboxes are at lines 338–345. Add `disabled={!isOwner}` to each checkbox input:

  ```tsx
  <label className={styles.toggle}>
    <input
      type="checkbox"
      checked={officeFriendly}
      onChange={(e) => handleToggle("officeFriendly", e.target.checked)}
      disabled={!isOwner}
    />
    <span>{t.meals.officeLabel}</span>
  </label>
  <label className={styles.toggle}>
    <input
      type="checkbox"
      checked={thirtyMinute}
      onChange={(e) => handleToggle("thirtyMinute", e.target.checked)}
      disabled={!isOwner}
    />
    <span>{t.meals.quickLabel}</span>
  </label>
  ```

- [ ] **Step 4: Gate notes field**

  The notes section starts at line 348. For non-owners, always render the read-only branch (no `onClick`):

  ```tsx
  <div className={styles.fieldSection}>
    <span className={styles.fieldLabel}>{t.meals.notesLabel}</span>
    {isOwner && editingField === "notes" ? (
      <textarea
        autoFocus
        className={styles.fieldTextarea}
        value={draftNotes}
        onChange={(e) => { setDraftNotes(e.target.value); autoResize(e.target) }}
        onBlur={handleNotesBlur}
        ref={(el) => { if (el) autoResize(el) }}
      />
    ) : (
      <div
        className={styles.editableField}
        onClick={isOwner ? () => setEditingField("notes") : undefined}
      >
        {draftNotes
          ? <div className={styles.markdown}><ReactMarkdown>{draftNotes}</ReactMarkdown></div>
          : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>{t.meals.notesEmptyPrompt}</span>
        }
      </div>
    )}
  </div>
  ```

- [ ] **Step 5: Gate source field**

  The source section starts at line 369. For non-owners, render the read-only branch directly without `onClick`:

  ```tsx
  <div className={styles.fieldSection}>
    <span className={styles.fieldLabel}>{t.meals.sourceLabel}</span>
    {isOwner && editingField === "source" ? (
      <input
        autoFocus
        className={styles.sourceInput}
        value={draftSource}
        onChange={(e) => setDraftSource(e.target.value)}
        onBlur={handleSourceBlur}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
        placeholder={t.meals.sourcePlaceholder}
      />
    ) : (
      <div
        className={styles.editableField}
        onClick={isOwner ? () => setEditingField("source") : undefined}
      >
        {draftSource
          ? isUrl(draftSource)
            ? <a href={draftSource} target="_blank" rel="noopener noreferrer" className={styles.sourceLink} onClick={(e) => e.stopPropagation()}>{draftSource}</a>
            : <span>{draftSource}</span>
          : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>{t.meals.sourceEmptyPrompt}</span>
        }
      </div>
    )}
  </div>
  ```

- [ ] **Step 6: Gate ingredients field**

  The ingredients section starts at line 393. Same pattern — gate the textarea on `isOwner && editingField === "ingredients"`, suppress `onClick` for non-owners:

  ```tsx
  <div className={styles.fieldSection}>
    <span className={styles.fieldLabel}>{t.meals.ingredientsLabel}</span>
    {isOwner && editingField === "ingredients" ? (
      <textarea
        autoFocus
        className={styles.fieldTextarea}
        value={draftIngredients}
        placeholder={"200g flour\n2 eggs"}
        onChange={(e) => { setDraftIngredients(e.target.value); autoResize(e.target) }}
        onBlur={handleIngredientsBlur}
        ref={(el) => { if (el) autoResize(el) }}
      />
    ) : (
      <div
        className={styles.editableField}
        onClick={isOwner ? () => setEditingField("ingredients") : undefined}
      >
        {meal.ingredients.length > 0
          ? <div className={styles.ingredientsList}>
              {meal.ingredients.map((item, i) => (
                <div key={i} className={styles.ingredientRow}><ReactMarkdown>{item}</ReactMarkdown></div>
              ))}
            </div>
          : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>{t.meals.ingredientsEmptyPrompt}</span>
        }
      </div>
    )}
  </div>
  ```

- [ ] **Step 7: Gate steps field and wand button**

  The steps section starts at line 419. Gate the wand button with `isOwner &&` (preserving the existing `meal.steps.length > 0` guard), and suppress `onClick` for non-owners:

  ```tsx
  <div className={styles.fieldSection}>
    <div className={styles.fieldLabelRow}>
      <span className={styles.fieldLabel}>{t.meals.preparationSteps}</span>
      {isOwner && meal.steps.length > 0 && (
        <button
          type="button"
          className={styles.fieldWandBtn}
          onClick={handleReformatSteps}
          disabled={reformattingSteps}
          title="Format with AI"
        >
          <Wand2 size={13} strokeWidth={2} />
        </button>
      )}
    </div>
    {isOwner && editingField === "steps" ? (
      <textarea
        autoFocus
        className={styles.fieldTextarea}
        value={draftSteps}
        placeholder={"Mix flour and eggs.\nKnead for 10 min."}
        onChange={(e) => { setDraftSteps(e.target.value); autoResize(e.target) }}
        onBlur={handleStepsBlur}
        ref={(el) => { if (el) autoResize(el) }}
      />
    ) : (
      <div
        className={styles.editableField}
        onClick={isOwner ? () => setEditingField("steps") : undefined}
      >
        {meal.steps.length > 0
          ? <div className={styles.markdown}><ReactMarkdown>{meal.steps.join("\n\n")}</ReactMarkdown></div>
          : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>{t.meals.stepsEmptyPrompt}</span>
        }
      </div>
    )}
  </div>
  ```

- [ ] **Step 8: Verify TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | grep "meals/\[id\]"
  ```

  Expected: no output.

- [ ] **Step 9: Verify in browser — full golden path**

  With dev server running:

  1. **Anonymous visitor** — open a recipe URL in a private/incognito window:
     - Name renders as static text (not input)
     - No star, delete buttons
     - Image placeholder not clickable (if no image)
     - Image action buttons hidden (if image present)
     - All selects render as text
     - Servings renders as text
     - Checkboxes are disabled (greyed)
     - Clicking notes/ingredients/steps/source does nothing
     - No wand button
     - Source link (if URL) still opens in new tab

  2. **Owner** — log in as a family member and visit the same recipe:
     - All editing controls present and functional
     - Click-to-edit fields open textarea on click
     - Name is an input field
     - Star, delete buttons visible
     - Wand button visible (if recipe has steps)

  3. **Cross-family user** — if you have two families in your dev DB, log in as family B and visit a recipe from family A:
     - Read-only view (same as anonymous)

- [ ] **Step 10: Commit**

  ```bash
  git add src/app/meals/[id]/page.tsx
  git commit -m "feat: gate all editing controls on isOwner for public recipe sharing"
  ```
