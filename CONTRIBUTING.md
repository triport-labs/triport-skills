# Contributing

Keep each skill portable: its resources must live inside its own directory.
Describe concrete activation triggers in YAML frontmatter and cite public Triport
documentation for methods, routes and limits. Keep SKILL.md bodies within 500 lines
and descriptions within 1024 characters. Do not commit keys or resolved keyed URLs.

With Node.js 22+ and Python 3.12+, run `npm ci --ignore-scripts` and `npm run check`.
Every TypeScript and Python fence inside skills is compiled; use complete snippets.
The checks use no credentials and make no production API calls. Document live
checks separately and never send funded transactions as a documentation test.
