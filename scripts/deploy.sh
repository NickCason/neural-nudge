#!/usr/bin/env bash
# Build the site and publish dist/ to the gh-pages branch, which GitHub Pages serves.
# Usage: npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

npm test
npm run build

remote=$(git remote get-url origin)
rev=$(git rev-parse --short HEAD)
name=$(git config user.name)
email=$(git config user.email)

cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$name" -c user.email="$email" commit -q -m "Deploy $rev"
git push -q --force "$remote" gh-pages
rm -rf .git
echo "Published $rev to gh-pages"
