# Changesets

This project uses [changesets](https://github.com/changesets/changesets) for versioning and changelog generation.

## Adding a changeset

When you make a change that should be released, run:

```bash
npx changeset
```

This will prompt you to:
1. Select which packages are affected (all packages share the same version)
2. Choose a bump type (patch / minor / major)
3. Write a summary of the change

A markdown file will be created in this directory — commit it with your PR.

## How releases work

1. Changesets accumulate in `.changeset/` as PRs merge to `main`
2. A GitHub Action automatically creates a "Version Packages" PR that bumps versions and generates changelogs
3. Merging that PR triggers `npm publish` for all packages
