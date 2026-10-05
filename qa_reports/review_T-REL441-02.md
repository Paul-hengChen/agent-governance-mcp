# QA review T-REL441-02 (release-v4.4.1, AC3 + AC4)

## AC3 full suite under test lock, HEAD 0ec1504
| run | command | result |
|---|---|---|
| 1 | `node scripts/test-lock.mjs -- npm test` | exit 0; tests 3043, pass 3040, fail 0, cancelled 0, skipped 3; duration 228 s |
No red, so no rerun of e132 gap-6 (E254) or teamwork-lite AC3b (E257) was needed; there is no second run. Matches the expected 3043/3040/3 tally.
Verdict AC3: PASS.

## AC4 clean build and version
| check | command | result |
|---|---|---|
| build | `npm run build` | exit 0 |
| dist parity | `git status --porcelain dist/` | empty |
| version | `node scripts/check-version.mjs` | exit 0; dist/index.js and package-lock parity OK (4.4.0); note that HEAD is past tag v4.4.0 (expected, the bump is release-engineer's) |
Verdict AC4: PASS.
