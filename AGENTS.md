# Owl's Watch Agent Rules

Before coding in this repo, read:

- `/Users/dennis/Projects/owhub/docs/agent-operating-system.md`
- `/Users/dennis/Projects/owhub/docs/how-we-work.md`
- `/Users/dennis/Projects/owhub/docs/testing-standard.md`

Non-negotiables:

- Dennis does not run or review local builds.
- Do not use localhost as the final validation path.
- Use deployed Vercel test environments for UAT when available.
- After relevant tests and UAT pass, commit and push to `origin/main`.
- If production does not update automatically, deploy or promote production and verify the live URL.
- Final responses must state what was tested, where it was tested, what was pushed, and whether production is live.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
