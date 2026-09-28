# Pending tickets — lane e232

## Applied

```pending-ticket
lane_local_id: E232-NEW-1
title: Decide whether adopter project directory names in tracked docs count under Information hygiene
priority: P3
depends_on: [E232]
source: e232 code review (T-E232-01..08), optional note
body: |
  E232 replaced absolute local paths with home-relative placeholders, which leaves an
  adopter project's own directory name visible in a few tracked files (it already appears
  elsewhere in the tree). It is not one of the three classes E232 covered; a human ruling
  on whether adopter project names are sensitive would settle it, and E234's scan
  patterns could then include or exclude the class.
```

```pending-ticket
lane_local_id: E232-NEW-2
title: Replace prose citations of non-existent files left by the leak cleanup with plain descriptions
priority: P3
depends_on: [E232]
source: e232 code review (T-E232-01..08), optional note
body: |
  After genericization, CHANGELOG and one research file name a governance-recommendations
  file that exists under neither its old nor its new name, and a few relative links point
  at files that never existed in the tree (pre-existing, not introduced by E232). Describe
  them in words or drop the links; fits E233's readability pass.
```
