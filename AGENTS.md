# Owl's Watch Agent Rules

Before coding in this repo, read:

- `/Users/dennis/Projects/owhub/docs/agent-operating-system.md`
- `/Users/dennis/Projects/owhub/docs/how-we-work.md`
- `/Users/dennis/Projects/owhub/docs/testing-standard.md`

Non-negotiables:

- Dennis does not run or review local builds.
- Do not use localhost as the final validation path.
- If a Vercel test environment exists, deploy the current candidate there and complete UAT there before production.
- Do not treat a stale test deployment as valid UAT; test must contain the code being shipped.
- If no test environment exists, stop and state that gap before any production-impacting step unless Dennis explicitly approves the risk.
- After relevant tests and UAT pass, commit and push to `origin/main`.
- If production does not update automatically, deploy or promote production and verify the live URL.
- Final responses must state what was tested, where it was tested, the test deployment URL, what was pushed, and whether production is live.

## Deployment Environments

- Vercel project: `partners`
- Test UAT URL: `https://partners-env-test-dennis-projects-b028c121.vercel.app`
- Production URL: `https://cms.owlswatch.com`

Before production-impacting work, deploy the current candidate to the Test UAT URL and verify that exact deployment. Do not use localhost or an older test deployment as the final validation path.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
