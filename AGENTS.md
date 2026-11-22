<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Student data is read and written only through the stores in `src/lib/data/stores.ts`; `src/lib/data/cloud-sync.ts` mirrors each store to one `student_data` row per (user, key) while signed in, and the account copy wins on load; why: pages stay storage-agnostic and guests still work offline in the browser.
- AI model order (direct Gemini models, per-attempt timeout) is defined once in `src/lib/tutor-prompt.ts` and shared by Companion and Quiz Studio; why: one place to change models.
- Seeded sample records carry `isDemo` / demo IDs and the UI labels them; why: demonstration data must stay distinguishable from real student records.
- AI calls (Companion and Quiz Studio) run server-side via `*.server.ts`: Gemini direct with GEMINI_API_KEY first, Lovable AI Gateway as backup; pre-written replies are only an outage fallback and are labelled as samples; why: the product must never pass a sample off as live AI.
- Exam/curriculum, class levels and subject/topic resolution live in `src/lib/study-context.ts`, shared by both AI pages and the server prompts; questions on a typed subject carry `subjectLabel` and their scores go to `customQuizAttemptsStore`, never `quizAttemptsStore`; why: built-in subject stats, weak areas and revision dates only know the built-in subjects.
- Domain rules (quiz generation/scoring, planner dates, revision flags) live as pure functions in `src/lib/*.ts` with tests in `src/test/`; why: keeps rules testable apart from the UI.
- Colours, gradients and subject colours are tokens in `src/styles.css`; subject classes come from `SUBJECT_STYLES`; why: Tailwind only keeps literal class names and theming stays in one place.
