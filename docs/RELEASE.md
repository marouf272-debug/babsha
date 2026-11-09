# Release runbook

How a new version of Babsha goes live, how to put an older one back, and the checklist for each release (plan phase 6, D-101 to D-104).

- Live link: https://marouf-glitch.github.io/babsha/
- Code: https://github.com/marouf-glitch/babsha (public)
- Host: GitHub Pages, free plan. Soft limit 100 GB of traffic a month, far above what friends will use.

## Release a new version

1. Make sure `main` is green: the Tests workflow on GitHub has a green tick for the last commit.
2. Pick the next version (semantic numbering): a fix is 1.0.1, a new feature is 1.1.0. A test run before a real release gets `-rc.1`, `-rc.2` and so on.
3. Set it and tag it:

   ```bash
   npm version 1.0.1 -m "Release %s"
   git push origin main --follow-tags
   ```

4. The Release workflow runs the full test suite, builds the site, keeps the build as a zip on a GitHub Release and publishes it. It takes about 10 minutes. Follow it with `gh run watch` or on the Actions tab.
5. Check it is live: `curl -s https://marouf-glitch.github.io/babsha/version.json` shows the new version (GitHub's cache can take a few minutes). The setup screen shows it too.

If the tests fail, nothing is published. The site stays on the last good version.

## Roll back

Puts the exact build of an earlier release back live. Nothing is rebuilt.

```bash
gh workflow run rollback.yml -f tag=v1.0.0
```

Then check `version.json` as in step 5. To move forward again, run the same command with the newer tag, or release a fixed version.

Phones that already opened the game pick up the change the next time they open it with a connection: the page itself is always fetched fresh when online, and only offline does it come from the phone's copy.

## Release checklist (plan phase 6)

| Check | How |
|---|---|
| All tests green | The Release workflow fails if any test fails. |
| Device check passed | On the iPhone: open the live link in Safari, start a game, Share, Add to Home Screen, open it from the home screen, then turn on airplane mode, close and reopen it and play a few turns. |
| Font licenses recorded | docs/LICENSES.md lists every font and third-party file. |
| No tracking in the build | The end to end test "no request ever leaves the site" checks every request during a game. |
| Rollback rehearsed once | Done in S8 (D-105). Repeat if the workflows change. |
| Owner sign-off | Gate G6. |

## Other tasks

- New home screen icon: change the colors in data/app.json, run `node scripts/make-icons.ts`, commit the PNGs in assets/icons.
- New or changed Bangla text: it goes under keys in data/bn-review.json. Run `npm run review:export` to make the sheet for a reviewer, and `npm run review:import -- <file>` to apply it (docs/bangla-review.md).
