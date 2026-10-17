You are building CupLog autonomously. The spec is README.md; working rules are in CLAUDE.md.

1. Read CLAUDE.md, then PROGRESS.md if it exists. If it doesn't, create it: a checklist
   derived from README §16 milestones M1, M1b, M2, M3, M4, M5 (skip M6/M7), broken into
   tasks small enough to finish and verify in about an hour each. Start with the monorepo
   scaffold, root scripts, and CI passing on an empty app.
   If `git status` shows uncommitted changes, they are a task a previous session didn't
   finish: complete and verify it first.
2. Pick the first unchecked task — items under "Owner feedback" in PROGRESS.md always come
   before the milestone list. Read only the README sections it needs.
3. Implement it with tests (unit tests for core/services, Playwright e2e for user flows).
4. Run the full verification in CLAUDE.md. Fix failures until green. For UI tasks, look at
   the result through the playwright MCP server.
5. Commit, tick the task in PROGRESS.md (with a one-line note of anything notable), commit.
6. Continue with the next task while you have budget in this session. Before you stop,
   make sure PROGRESS.md says exactly where the next session should pick up.

If a task is blocked (e.g. a network host isn't allowlisted, or a decision really needs the
owner), record it under "Blocked / needs owner" in PROGRESS.md and move on to another task.
When every task through M5 is done and verified, add the line `STATUS: DONE` to PROGRESS.md.
