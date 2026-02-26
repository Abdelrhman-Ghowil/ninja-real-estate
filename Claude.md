You are a senior frontend engineer + product designer.
Build a modern web app called "Ninja Real Estate" using React + Vite.
Prioritize UI/UX excellence and modern interaction patterns following the principles of "ui-ux-pro-max-skill" (design system thinking, clean layout, accessibility, micro-interactions, and clear hierarchy). Use a consistent design system, spacing scale, and typography rules. :contentReference[oaicite:1]{index=1}

TECH REQUIREMENTS
- Framework: React + Vite (JavaScript or TypeScript is fine; prefer TypeScript).
- Styling: TailwindCSS (preferred) OR CSS Modules. Use a modern, premium, minimal aesthetic.
- Routing: React Router.
- Data fetching: TanStack Query (React Query).
- State: minimal local state; use Query cache.
- Forms: React Hook Form + Zod validation.
- Animations: Framer Motion.
- Swipe UI: implement swipe cards (Tinder-style). Use pointer/touch drag + swipe threshold + buttons (Approve/Reject) as fallback.
- Notifications: toast (e.g., Sonner or react-hot-toast).
- Date formatting: dayjs.
- Environment variables: VITE_API_BASE_URL.

API INTEGRATION (n8n)
Base URL: https://superpowerss.app.n8n.cloud
Endpoints:
1) LIST records:
GET /webhook/api/list
- returns an array of records like:
{
  "id": 1,
  "location": "النعيرية – المنطقة الشرقية",
  "city": "النعيرية",
  "region": "المنطقة الشرقية",
  "area_m2": "1080",
  "price": "400000",
  "currency": "SAR",
  "contract_duration_years": "10",
  "building_status": "تحت التشطيب",
  "expected_completion_min_months": "3",
  "expected_completion_max_months": "4",
  "raw_text": "...",
  "Status": null,
  "createdAt": "2026-02-24T16:46:12.134Z",
  "updatedAt": "2026-02-24T16:46:12.134Z"
}

2) CREATE record:
POST /webhook/api/list
Body example:
{
 "location": "...",
 "city": "...",
 "region": "...",
 "area_m2": "...",
 "price": "...",
 "currency": "SAR",
 "contract_duration_years": "...",
 "building_status": "...",
 "expected_completion_min_months": "...",
 "expected_completion_max_months": "...",
 "raw_text": "...",
 "Status": null
}

3) UPDATE record:
POST /webhook/api/list
- For update, include "id" in body + fields to update (including Status).
Status values:
- "APPROVED"
- "REJECTED"
- null (PENDING)

APP PAGES & FLOWS
1) Login Page (/login)
- Simple login (username/password) with a local demo auth (no backend).
- Use localStorage session token.
- After login → redirect to Swipe Review page.
- Add logout in top-right user menu.

2) Swipe Review Page (/review) [PROTECTED]
- Fetch records from LIST endpoint.
- Show only records where Status is null (PENDING) by default.
- Present cards one-by-one with swipe gestures:
  - Swipe right = Approve
  - Swipe left = Reject
- Also provide buttons: Approve / Reject / Undo.
- When user approves/rejects:
  - Optimistic update UI instantly.
  - Send UPDATE request with { id, Status: "APPROVED" } or { id, Status: "REJECTED" }.
  - On error → revert and show toast.
- Card design: show location/city/region, price, area, contract, status, expected completion, and a collapsible section for raw_text.
- Add filter chips: Pending / Approved / Rejected / All.
- Add a progress indicator: "Pending: X / Total: Y".

3) Records Table Page (/records) [PROTECTED]
- A modern table/grid view of all records with:
  - Live refresh (polling every 10–20 seconds) and "Refresh" button.
  - Sorting by createdAt (default newest first).
  - Search (location/city/region/raw_text).
  - Filters by Status.
  - Row actions: Approve / Reject (update Status), View details modal.
- Show badges for Status with distinct visual styles.
- Ensure responsive: on mobile use stacked cards instead of table.

4) Public Submit Form Page (/submit) [PUBLIC - NO LOGIN]
- Anyone with the link can submit a new record.
- Form fields: location, city, region, area_m2, price, contract_duration_years, building_status, expected_completion_min_months, expected_completion_max_months, raw_text.
- Set currency default "SAR" and Status default null.
- Validate required fields: location, price, area_m2 (or allow raw_text-only but then you must keep fields as empty strings/null).
- On submit success → success screen with "Submit another" button.
- Add subtle anti-spam UX: disable submit while loading, basic rate limit UI hint (no backend), and honeypot hidden input.

DESIGN & UX (must be excellent)
- Build a consistent design system:
  - 8pt spacing scale
  - typography scale
  - color tokens
  - elevation/shadows
  - border radius (large, modern)
- RTL support for Arabic content:
  - Use dir="rtl" for Arabic-heavy views or use logical properties.
  - Keep numbers aligned and readable.
- Use skeleton loaders, empty states, and error states.
- Micro-interactions: hover, pressed states, smooth transitions, swipe animations.
- Accessibility: keyboard navigation, aria labels, contrast, focus rings.

ARCHITECTURE
- Create a clean folder structure:
  src/
    api/ (client + typed models)
    components/
    pages/
    hooks/
    utils/
    styles/
- Create an API client wrapper with fetch + error handling.
- Use TanStack Query keys: ["records"], ["records", "status", ...]
- Normalize/parse numeric fields (area_m2, price, contract_duration_years, expected months) to numbers in UI layer.

DELIVERABLE
- Provide:
  1) Full project file structure
  2) Key code files: main.tsx, router, auth, api client, pages (login/review/records/submit), core components (SwipeCard, RecordTable, StatusBadge)
  3) Instructions to run: npm install, npm run dev
  4) Example .env with VITE_API_BASE_URL=https://superpowerss.app.n8n.cloud

IMPORTANT
- Do not use mock data except for login.
- Do not hardcode API base URL in files (use env).
- Ensure the app works on mobile and desktop.
- Ensure the UI looks premium and modern.