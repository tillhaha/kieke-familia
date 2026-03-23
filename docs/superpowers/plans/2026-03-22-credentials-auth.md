# Credentials Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add username/password sign-in alongside Google OAuth, with parent-managed child account creation in Settings.

**Architecture:** Add `username` + `passwordHash` to the User model; wire a next-auth `CredentialsProvider` that looks up by username and verifies a bcrypt hash; expose two new API routes for child account CRUD; add a Children tab in Settings and a credentials form on the login page.

**Tech Stack:** Next.js 16, next-auth 4, Prisma 7 (PostgreSQL), bcryptjs, CSS Modules

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` — add `username`, `passwordHash` to `User` |
| Modify | `src/lib/auth.ts` — add `CredentialsProvider` |
| Create | `src/app/api/family/members/route.ts` — POST create child account |
| Create | `src/app/api/family/members/[id]/route.ts` — PATCH reset password |
| Create | `src/app/settings/ChildrenSection.tsx` — new settings tab |
| Modify | `src/app/settings/page.tsx` — add Children tab to sidebar |
| Modify | `src/app/page.tsx` — add credentials login form |
| Modify | `src/app/page.module.css` — styles for credentials form + separator |

---

## Task 1: Schema — add username + passwordHash to User

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to User model**

In `prisma/schema.prisma`, find the `User` model and add two fields after `image String?`:

```prisma
  username     String?  @unique
  passwordHash String?
```

The full User model top section should look like:
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  username      String?   @unique
  passwordHash  String?
  accounts      Account[]
  sessions      Session[]
  ...
```

- [ ] **Step 2: Push schema to database**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add username and passwordHash fields to User"
```

---

## Task 2: Install bcryptjs + add CredentialsProvider

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Install bcryptjs**

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

- [ ] **Step 2: Add CredentialsProvider to auth.ts**

Replace the contents of `src/lib/auth.ts` with:

```typescript
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user?.passwordHash) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.familyId = (user as Record<string, unknown>).familyId
        token.role = (user as Record<string, unknown>).role
        token.name = user.name
      }
      if (trigger === "update" && session?.name !== undefined) {
        token.name = session.name
      }
      // Refresh familyId from DB if missing (covers credential users on first login)
      if (!token.familyId && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { familyId: true, role: true },
        })
        if (dbUser?.familyId) token.familyId = dbUser.familyId
        if (dbUser?.role) token.role = dbUser.role
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as Record<string, unknown>).id = token.id as string | undefined
        (session.user as Record<string, unknown>).familyId = token.familyId as string | undefined
        (session.user as Record<string, unknown>).role = token.role as string | undefined
        session.user.name = (token.name as string | null) ?? null
      }
      return session
    },
  },
  pages: {
    signIn: "/",
  },
}
```

- [ ] **Step 3: Verify dev server starts without errors**

```bash
npm run dev
```

Expected: server starts, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts package.json package-lock.json
git commit -m "feat: add CredentialsProvider with bcryptjs to next-auth"
```

---

## Task 3: API route — POST /api/family/members

**Files:**
- Create: `src/app/api/family/members/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/family/members/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { familyId } = session.user as Record<string, unknown> as { familyId?: string }
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const members = await prisma.user.findMany({
    where: { familyId, username: { not: null } },
    select: { id: true, name: true, username: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ members })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessionUser = session.user as Record<string, unknown>
  const familyId = sessionUser.familyId as string | undefined
  const role = sessionUser.role as string | undefined

  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })
  if (role !== "PARENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { name, username, password } = body as { name?: string; username?: string; password?: string }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 })
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  // Check username uniqueness
  const existing = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      username: username.trim(),
      passwordHash,
      familyId,
      role: "MEMBER",
    },
    select: { id: true, name: true, username: true },
  })

  return NextResponse.json({ member: user }, { status: 201 })
}
```

- [ ] **Step 2: Manually test GET (should return empty array)**

With the dev server running, open the app, go to `/settings`. In browser DevTools console run:
```js
fetch('/api/family/members').then(r => r.json()).then(console.log)
```
Expected: `{ members: [] }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/family/members/route.ts
git commit -m "feat: add GET and POST /api/family/members"
```

---

## Task 4: API route — PATCH /api/family/members/[id]

**Files:**
- Create: `src/app/api/family/members/[id]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/family/members/[id]/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessionUser = session.user as Record<string, unknown>
  const familyId = sessionUser.familyId as string | undefined
  const role = sessionUser.role as string | undefined

  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })
  if (role !== "PARENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Verify target user is in the same family
  const target = await prisma.user.findUnique({
    where: { id },
    select: { familyId: true },
  })
  if (!target || target.familyId !== familyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { password } = body as { password?: string }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/family/members/[id]/route.ts
git commit -m "feat: add PATCH /api/family/members/[id] for password reset"
```

---

## Task 5: ChildrenSection settings component

**Files:**
- Create: `src/app/settings/ChildrenSection.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/app/settings/ChildrenSection.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import styles from "./settings.module.css"

type Member = { id: string; name: string; username: string }

export function ChildrenSection() {
  const { data: session } = useSession()
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined
  const canManage = role === "PARENT" || role === "ADMIN"

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  // Reset password state per member
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [resetError, setResetError] = useState("")
  const [resetting, setResetting] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/family/members")
      const data = await res.json()
      setMembers(data.members ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError("")
    setCreating(true)
    try {
      const res = await fetch("/api/family/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create account")
        return
      }
      setName("")
      setUsername("")
      setPassword("")
      await fetchMembers()
    } finally {
      setCreating(false)
    }
  }

  async function handleResetPassword(id: string) {
    setResetError("")
    setResetting(true)
    try {
      const res = await fetch(`/api/family/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResetError(data.error ?? "Failed to reset password")
        return
      }
      setResetId(null)
      setResetPassword("")
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Children</h2>
      <p className={styles.sectionDesc}>
        Child accounts use a username and password to sign in — no Google account needed.
        {!canManage && " Only parents can create or manage child accounts."}
      </p>

      {loading ? (
        <p className={styles.spinner}>Loading…</p>
      ) : members.length === 0 ? (
        <p className={styles.emptyMsg}>No child accounts yet.</p>
      ) : (
        <div className={styles.memberList}>
          {members.map((m) => (
            <div key={m.id} className={styles.memberRow}>
              <div className={styles.memberInfo}>
                <span className={styles.memberName}>{m.name}</span>
                <span className={styles.memberUsername}>@{m.username}</span>
              </div>
              {canManage && (
                <div className={styles.memberActions}>
                  {resetId === m.id ? (
                    <>
                      <input
                        type="password"
                        placeholder="New password (min 8)"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className={styles.fieldInput}
                      />
                      {resetError && <p className={styles.saveError}>{resetError}</p>}
                      <button
                        onClick={() => handleResetPassword(m.id)}
                        disabled={resetting || resetPassword.length < 8}
                        className={styles.saveBtn}
                      >
                        {resetting ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setResetId(null); setResetPassword(""); setResetError("") }}
                        className={styles.cancelBtn}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setResetId(m.id); setResetPassword(""); setResetError("") }}
                      className={styles.cancelBtn}
                    >
                      Reset password
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <>
          <h3 className={styles.subTitle}>Add child account</h3>
          <form onSubmit={handleCreate}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Display name</label>
              <input
                type="text"
                placeholder="Emma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.fieldInput}
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Username</label>
              <input
                type="text"
                placeholder="emma-smith"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.fieldInput}
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Password</label>
              <input
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.fieldInput}
                required
                minLength={8}
              />
            </div>
            {createError && <p className={styles.saveError}>{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className={styles.saveBtn}
            >
              {creating ? "Creating…" : "Create account"}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add missing CSS classes to settings.module.css**

Add at the end of `src/app/settings/settings.module.css`:

```css
/* ── Children Section ────────────────────────────────────── */

.subTitle {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem;
}

.memberList {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.memberRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.memberRow:last-child {
  border-bottom: none;
}

.memberInfo {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.memberName {
  font-size: 0.9375rem;
  font-weight: 500;
}

.memberUsername {
  font-size: 0.8125rem;
  color: var(--secondary);
}

.memberActions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cancelBtn {
  padding: 0.4rem 0.875rem;
  background: transparent;
  color: var(--secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 150ms, color 150ms;
  white-space: nowrap;
}

.cancelBtn:hover {
  border-color: var(--foreground);
  color: var(--foreground);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/ChildrenSection.tsx src/app/settings/settings.module.css
git commit -m "feat: add ChildrenSection settings component"
```

---

## Task 6: Add Children tab to Settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Update settings/page.tsx**

Replace the full file content:

```typescript
// src/app/settings/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { GoogleSection } from "./GoogleSection"
import { ProfileSection } from "./ProfileSection"
import { LocationSection } from "./LocationSection"
import { ChildrenSection } from "./ChildrenSection"
import styles from "./settings.module.css"

type Section = "profile" | "google" | "location" | "children"

export default function SettingsPage() {
  const { status } = useSession()
  const [activeSection, setActiveSection] = useState<Section>("profile")

  if (status === "loading") return null

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Settings</p>
        <button
          className={`${styles.sectionBtn} ${activeSection === "profile" ? styles.active : ""}`}
          onClick={() => setActiveSection("profile")}
        >
          Profile
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "google" ? styles.active : ""}`}
          onClick={() => setActiveSection("google")}
        >
          Google
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "location" ? styles.active : ""}`}
          onClick={() => setActiveSection("location")}
        >
          Location
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "children" ? styles.active : ""}`}
          onClick={() => setActiveSection("children")}
        >
          Children
        </button>
      </aside>

      <div className={styles.content}>
        {activeSection === "profile" && <ProfileSection />}
        {activeSection === "google" && <GoogleSection />}
        {activeSection === "location" && <LocationSection />}
        {activeSection === "children" && <ChildrenSection />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manually verify Children tab appears in Settings**

Navigate to `/settings` in the browser. Confirm a "Children" tab appears in the sidebar and renders the section content.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add Children tab to Settings sidebar"
```

---

## Task 7: Update login UI with credentials form

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`

- [ ] **Step 1: Update page.tsx sign-in block**

Replace only the unauthenticated return block in `src/app/page.tsx` (lines 79–92):

```typescript
  if (!session) {
    return (
      <div className={styles.signInPage}>
        <div className={styles.signInCard}>
          <h1 className={styles.signInTitle}>Welcome to Familia</h1>
          <p className={styles.signInSubtitle}>Your shared family management hub.</p>

          <button onClick={() => signIn("google", { callbackUrl: "/" })} className={styles.signInBtn}>
            <LogIn size={16} />
            Sign in with Google
          </button>

          <div className={styles.divider}>
            <span className={styles.dividerText}>or</span>
          </div>

          <CredentialsForm />
        </div>
      </div>
    )
  }
```

Also add the `CredentialsForm` component at the bottom of the file, before the closing of the module (after the `Home` export):

```typescript
function CredentialsForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const result = await signIn("credentials", {
      username,
      password,
      callbackUrl: "/",
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError("Invalid username or password")
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.credentialsForm}>
      <div className={styles.credentialField}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={styles.credentialInput}
          autoComplete="username"
          required
        />
      </div>
      <div className={styles.credentialField}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.credentialInput}
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className={styles.credentialError}>{error}</p>}
      <button type="submit" disabled={loading} className={styles.signInBtn}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Add CSS for divider and credentials form to page.module.css**

Add at the end of `src/app/page.module.css`:

```css
/* Credentials login form */

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.5rem 0;
  color: var(--secondary);
  font-size: 0.8125rem;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.dividerText {
  white-space: nowrap;
}

.credentialsForm {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: 100%;
}

.credentialField {
  width: 100%;
}

.credentialInput {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--foreground);
  font-size: 0.9375rem;
  font-family: inherit;
  outline: none;
  transition: border-color 150ms;
  box-sizing: border-box;
}

.credentialInput:focus {
  border-color: var(--primary);
}

.credentialError {
  font-size: 0.875rem;
  color: #dc2626;
  margin: 0;
}

@media (prefers-color-scheme: dark) {
  .credentialError {
    color: #f87171;
  }
}
```

- [ ] **Step 3: Verify the full login flow end-to-end**

1. Open the app in an incognito/private browser window (so you're logged out)
2. Confirm both "Sign in with Google" and the username/password form appear with a divider
3. In Settings → Children, create a test child account (display name: "Test Child", username: "testchild", password: "password123")
4. Sign out, then sign in with username `testchild` and password `password123`
5. Confirm you land on the home page with the greeting "Good [time], Test Child"
6. Confirm signing in with wrong credentials shows "Invalid username or password" inline

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/page.module.css
git commit -m "feat: add credentials login form to sign-in page"
```
