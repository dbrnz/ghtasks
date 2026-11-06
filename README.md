# GitHub Tasks

A desktop app (Tauri + Nuxt + Nuxt UI) for managing GitHub issues as a task list, inspired by [Taska](https://taska.now/).
All data lives on GitHub, so it stays compatible with anyone using GitHub directly.

## Features

- **Repositories sidebar**: add any repo you can access (⌘O), or type `owner/name`.
- **Task list**: grouped by milestone, label, priority or assignee, and sorted by priority, updated, created, assignee, title or number.
  - Click the checkbox to close or reopen a task. Double-click to rename it.
  - Edit labels and assignees inline. Right-click for more actions.
  - Pin tasks to the top of their group. Pins are local and only visible to you.
- **Quick add**: type in any group, e.g. `Fix login @alice #bug !high`. The task gets the group's milestone, label or assignee, and `@` and `#` autocomplete.
- **Search**: free text, `#123`, `@user`, `#label`, `!priority`; open, closed or all; anyone, me or unassigned.
- **Smart filters**: save the current search, filter, grouping and sort as a named view.
- **Inspector**: edit the title, status (completed or not planned), priority, assignees, labels, milestone, and the Markdown description (with a GitHub-rendered preview). Comments can be read, added, edited and deleted.
- **Batch edit**: ⌘-click or shift-click to select several tasks, then set their priority or milestone, add or remove labels and assignees, close or reopen them, or pin them.
- **Priorities** are labels: `priority: urgent|high|medium|low`. They are created on demand (see `app/utils/priority.ts`).
- **Keyboard**: `j`/`k` move, `n` new task, `/` search, `x` close or reopen, `p` pin, `1`–`4` set priority, `0` clear priority, `o` open on GitHub, `r` refresh. The keyboard button in the toolbar lists them all.
- **Sync**: changes are fetched every 2 minutes and when the window regains focus.

## Signing in

Use a GitHub personal access token: a classic token with the `repo` scope, or a fine-grained token with *Issues: read & write* and *Metadata: read*.
The token is stored in the webview's localStorage.

## Attachments

GitHub has no API for attaching files to issues or comments, so the editor's image/attach buttons (and paste or drag-and-drop) do what github.com does. You sign in to github.com once, in a GitHub window the app opens. Uploads then run inside a hidden github.com window using that session, and the file is stored at `https://github.com/user-attachments/assets/…` (see `src-tauri/src/github_web.rs`).

This relies on an undocumented github.com endpoint that GitHub can change at any time. It only works in the desktop app, and files must be under 25 MB.

## Development

```bash
bun install
bun run tauri dev     # desktop app
bun run dev           # browser only, http://localhost:3000
bun run typecheck
bun run tauri build   # bundle (runs `nuxt generate` → .output/public)
```

## Layout

- `app/composables/useGitHub.ts`: token and Octokit client
- `app/composables/useRepoData.ts`: per-repo cache of issues, labels, milestones and assignees, plus the API calls
- `app/composables/useTaskActions.ts`: edits with error toasts, shared by the list and the inspector
- `app/pages/[owner]/[repo].vue`: the task list (filtering, grouping, selection, shortcuts)
- `app/components/`: `TaskRow`, `QuickAdd`, `TaskInspector`, `BatchInspector`, `CommentThread`, `MarkdownEditor`, `TokenInput`, `PickerMenu`
- `src-tauri/`: Tauri shell, with the opener plugin so links open in the system browser

## License

GitHub Tasks is released under the [MIT License](LICENSE).
