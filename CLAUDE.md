# Heirloom: rules for every session
- Read only the files named in the task. Do not ask for the architecture doc.
- No plan or restatement first. Start with files.
- Run builds and tests yourself before saying done. If you cannot, say "not run".
- Foundry project lives in contracts/ and the git root is one level up: always run forge with --root contracts. Show at most 40 lines of any failing output.
- No home-made cryptography; only the libraries named in the prompt.
- Ambiguous spec: follow specs/00-decisions.md; if not covered, take the stricter option and append one line to specs/decisions-log.md.
- Finish with at most 10 lines: files changed, how to run tests, open issues.
- Do not change files outside your module. Design rules for any UI work are in docs/DESIGN.md.
