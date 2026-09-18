# Contributing

Thanks for contributing to ThusDev Fetch.

## Requirements

- Node.js 18 or newer
- npm
- Git

## Setup

```bash
npm install
```

## Validation

Run the complete local checks before opening a pull request:

```bash
npm run typecheck
npm test
npm run build
npm run pack:check
```

## Pull requests

- Keep changes focused.
- Preserve the public API unless the change is intentional and documented.
- Add tests for behavior changes.
- Update the changelog for user-facing changes.
- Keep source code free of comments that do not add necessary API documentation.

## Commit messages

Use concise messages that describe the change, for example:

```text
fix: handle timeout cleanup
feat: add typed response generics
```
