# Contributing Guide

This document describes the requirements for committing to this repository.

## Developer Certificate of Origin (DCO)

In order to contribute to this project, you must sign each of your commits to
attest that you have the right to contribute that code. This is done with the
`-s`/`--signoff` flag on `git commit`. More information about DCO can be found
[here](https://developercertificate.org/)

## Pull Request Management

All code that is contributed to this project must go through the Pull
Request (PR) process. To contribute a PR, fork this project, create a new
branch, make changes on that branch, and then use GitHub to open a pull request
with your changes.

Every PR must be reviewed by at least one Core Maintainer of the project. Once
a PR has been marked "Approved" by a Core Maintainer (and no other core
maintainer has an open "Rejected" vote), the PR may be merged. While it is fine
for non-maintainers to contribute their own code reviews, those reviews do not
satisfy the above requirement.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v22+)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Yarn](https://yarnpkg.com/) (v4, included via Corepack)
- [`cargo-edit`](https://github.com/killercup/cargo-edit) — provides `cargo set-version`, used by the `bump` script:

  ```bash
  cargo install cargo-edit
  ```

### Building

```bash
yarn install
yarn build        # release build
yarn build:debug  # debug build
```

Both `build` and `build:debug` run a version consistency check before compiling.
If the versions in `Cargo.toml`, `package.json`, and `testing/package.json` are
out of sync, the build will fail with a clear message.

### Version Management

The package version in `Cargo.toml` is the single source of truth. Several files
must stay in sync: `package.json`, `testing/package.json` (version and peer
dependency), and `yarn.lock`.

**Bumping the version:**

```bash
yarn bump <new-version>
```

For example: `yarn bump 0.18.0-alpha.1`. This command:

1. Runs `cargo set-version <new-version>` to update `Cargo.toml`
2. Runs `scripts/sync-version.js` to propagate the version to `package.json`
   and `testing/package.json`
3. Runs `yarn install` to refresh `yarn.lock`

After bumping, also run `cargo generate-lockfile` if `Cargo.lock` is committed.

**Checking version consistency (without modifying files):**

```bash
node scripts/sync-version.js --check
```

This is what the CI and the build scripts run to ensure all versions are aligned.

## Code of Conduct

This project has adopted the [CNCF Code of
Conduct](https://github.com/cncf/foundation/blob/master/code-of-conduct.md).
