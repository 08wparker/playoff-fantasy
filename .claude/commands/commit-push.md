---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*)
description: Stage all changes, commit with a message, and push to remote
---

Commit and push all changes to the remote repository.

## Instructions

1. Run `git status` to see all untracked and modified files
2. Run `git diff --staged` and `git diff` to see changes
3. Run `git log -3 --oneline` to see recent commit style
4. Stage all changes with `git add -A`
5. Create a commit with a descriptive message summarizing the changes. End the message with:

   🤖 Generated with [Claude Code](https://claude.ai/code)

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

6. Push to the remote with `git push`
7. Report the result to the user

If a commit message is provided, use it. Otherwise, analyze the changes and create an appropriate message.

**Provided message**: $ARGUMENTS
