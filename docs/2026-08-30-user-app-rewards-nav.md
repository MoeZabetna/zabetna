# User App: 4-tab nav + Rewards/Redeem UX (in progress, 2026-08-30)

Started per: "start with the user app using Figma design but we need to
add to the UX/UI the reward program and redeem." Decisions already made
with Mo before starting: design the new Rewards/Redeem screens in Figma
first (same process as the existing Home Screen), and add Rewards as a
**4th bottom-nav tab** rather than tucking it under Profile.

## Done and verified

1. **Bottom nav redesigned to 4 tabs, in Figma.** The nav is a single
   master component (`56:357`, `BottomNavigation`) instanced on 5
   screens (Home, Categories, Profile, Shops, Menu) — editing the master
   once propagated to all 5 instances automatically, confirmed live
   (each now reports width 327, was 255).
   - New width **327px** (was 255px) — chosen to match the 24px side
     margin every other Home Screen section already uses (searchbar,
     category grid), so the nav now aligns edge-to-edge with the rest
     of the layout instead of floating at an arbitrary width.
   - The new "Rewards" tile reuses an icon that was **already sitting in
     the file, unused and hidden**: `material-symbols-light:card-membership`
     (node `56:342`). It looks like an earlier, never-finished attempt at
     this same tab. Reusing it was the more honest call than importing a
     new icon — it's visually consistent with the rest of the nav by
     construction, and it means nothing net-new was drawn into the file.
     Recolored to the same inactive grey used by the other tabs
     (`#DDDDDD`-ish, `rgba(0.868,0.868,0.868)`), and made visible.
   - Tab order: **Home, Categories, Rewards, Profile.**
   - Verified with a screenshot after the edit — see the file, node
     `56:361` (the Home Screen instance) for the current state.
2. **Code updated to match** — `apps/user-app/src/components/BottomNav.tsx`:
   - `NavKey` now includes `"rewards"`.
   - New tab uses Ionicons `card-outline` — chosen specifically because
     it echoes the reused Figma "card-membership" icon rather than
     introducing a different metaphor (e.g. a gift icon) that wouldn't
     match what's actually in the design file.
   - Bar width `255 → 327`.
   - `npx tsc --noEmit` passes clean.
3. **Figma write access confirmed working**, despite `whoami` reporting
   the account's team seat as `"seat": "View"` (starter tier). This had
   been flagged as an open risk before starting — tested directly with a
   throwaway create+delete round trip before doing any real work, since
   a "View" seat would normally mean read-only. It isn't blocking writes
   in practice.

## Blocked, not done by choice

**The new Rewards/Redeem screens have not been built yet.** An empty
placeholder frame ("Rewards Screen", 375×812, positioned in the Main
Screens row) was created, and work had started on the balance/hero
section (pink→purple gradient, matching Profile Screen's header
exactly) when the Figma MCP connection returned:

> "You've reached the Figma MCP tool call limit on the Starter plan."

This is a hard limit on Mo's current Figma plan tier, not something
fixable from this session — no amount of retrying or working around it
changes that. The honest options, laid out for Mo directly rather than
guessed at:

1. **Wait** for the Starter plan's call quota to reset (Figma doesn't
   expose the reset window to the MCP client from here — Mo would need
   to check Figma's own billing/usage page for that).
2. **Upgrade the Figma plan** tied to that MCP quota — a billing
   decision only Mo can make.
3. In the meantime, keep making progress on anything that **doesn't**
   need Figma calls — e.g. the redeem-flow code/logic against the
   already-shipped backend (points balance, `reward_redemption_requests`,
   the $0.25/point rate), using the conventions already extracted from
   Profile Screen and Redemption Confirmation Screen in this session
   (Poppins Regular/Medium/SemiBold/Bold, the pink→purple gradient hex
   values, the white/rounded-12/soft-shadow card pattern, the
   purple `#913FE6`/rounded-8/48px-tall CTA button pattern).

## Rewards Screen — plan for when Figma calls are available again

Reusing the exact conventions read from Profile Screen and the
Redemption Confirmation screens in this session:

- Hero (gradient `#F281BC → #913FE6`, same as Profile): "AVAILABLE
  BALANCE" label, big points number, USD equivalent
  (`points × $0.25`, matching the admin Users tab's conversion).
- A white/rounded-12/soft-shadow card (same pattern as Profile's
  "Redemption Overview") holding the Redeem CTA.
- **Redeem button sweeps the full available balance — no amount
  picker** (per Mo's requirement) — purple `#913FE6`, rounded-8, 48px
  tall, same visual weight as the existing "Redeem Now" button on the
  shop Redemption Confirmation screen.
- Plain-language disclosure near the button: manual processing,
  24–72 hours, weekdays only, paid to Wish Money — matching what's
  already true of the backend (see `docs/rewards-program.md`).
- A **separate screen state** for "no phone number on file" (matching
  this file's own convention of building separate full screens per
  state rather than Figma variants — see the 3 existing "Redemption
  Confirmation Screen" frames), since `reward_redemption_requests`
  requires a phone number and the profile may not have one yet.
- A **Redeem Request Confirmation** screen (post-submit) stating the
  request was received and will process within the window above —
  again as its own screen, matching convention.

None of this has been drawn yet — this section is a plan, not a status
report of work done.
