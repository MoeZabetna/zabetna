# User App: Rewards Screen built in code (2026-09-02)

Continues `docs/2026-08-30-user-app-rewards-nav.md`, which ended blocked on
the Figma MCP call limit. This is what changed since, what got built, and
the two environment findings that came out of it.

## The Figma block is worse than last session recorded

Last session's writeup left the block as "wait for the Starter plan's call
quota to reset." Checking it properly today produced three corrections:

1. **The Starter limit is 20 tool calls per _month_, not per day.** Pulled
   from Figma's own `rate-limits-access.md` MCP resource. Mo's account is
   `tier: starter`, `seat: View`, which lands in the 20/month cell. The
   `Dev, Full` row on Starter is the *same* 20/month — so upgrading the
   seat alone changes nothing; the plan tier has to move to Professional
   or higher (200/day, 10/min) for this to be workable.
2. **`use_figma` is rate-limited too.** The exempt list is only
   `add_code_connect_map`, `create_new_file`, and `whoami`. There is no
   "writes are free" path — the tool that would actually draw the Rewards
   screen is metered like any read. Note that `whoami` succeeding proves
   nothing about remaining quota, since it's exempt.
3. **The window is rolling, not calendar-month.** One `get_metadata` call
   went through on 2026-09-02 and the very next call hit the paywall
   again. A calendar reset would have restored all 20 on Sep 1.

Practical consequence: 20 calls/month is roughly one screen per month.
The User App has ~20 screens left. Figma-first is not a viable process on
this plan tier regardless of patience.

## What the one available call bought

`get_metadata` on canvas `8:10` ("App UI") — the full screen inventory,
now cached in this repo rather than re-fetched. **The file key was
previously recorded nowhere**, which cost a round trip to Mo; it's now in
`docs/blueprint.html` §"Design source": `HgMscq70RckL87w5OoCDGb`.

Confirmed from that dump: `4016:192` "Rewards Screen" is a **375×812 frame
with no children** — the empty placeholder from last session. Nothing was
drawn. The reference frames the design plan depends on are all intact:
`70:2140` Profile Screen, `62:1905` / `122:2887` / `184:172` Redemption
Confirmation, `56:357` BottomNavigation master.

## What was built instead

Per option 3 in last session's doc — progress that needs no Figma calls.

- **`apps/user-app/src/lib/rewards.ts`** — reads
  `public.user_points_summary` (security_invoker, so RLS scopes it to the
  caller's own row; no `user_id` filter is sent or trusted) and inserts
  into `reward_redemption_requests` with **only `user_id`**. No amount is
  sent, because `set_reward_request_amounts()` overwrites
  `points_requested` / `usd_amount` / `phone_number` on every insert
  regardless of payload — sending an amount would create the false
  impression that the client decides the payout. Trigger rejections
  (no phone on file, balance under 40) are surfaced verbatim rather than
  replaced with a generic message; the trigger's own wording already says
  which rule was broken.
- **`apps/user-app/src/screens/RewardsScreen.tsx`** — balance hero, cash-out
  card, and states for loading / signed-out / error / below-minimum /
  no-phone / submitting / submitted / rejected.
- **`App.tsx`** — local tab state (same shape as
  `apps/restaurant-app/App.tsx`) so the Rewards tab added to the nav last
  session is actually reachable. React Navigation is still not wired up;
  Categories and Profile remain no-ops because no screen exists behind
  them yet.
- **Theme** — added Poppins SemiBold/Bold and the rewards type ramp;
  added the `#F281BC → #913FE6` gradient as a named token so the hero and
  the (future) Profile header can't drift apart.

Verified: `npx tsc --noEmit` clean, `npx expo export --platform ios`
produces a 2.5MB bundle.

### Design provenance, stated plainly

The screen was **not** built from a Figma frame, because there is no frame
— only the empty placeholder. It reuses conventions extracted from frames
that *were* read before the quota ran out: the Profile Screen gradient,
the white/rounded-12/soft-shadow card, and the purple `#913FE6`/rounded-8/
48px CTA from the Redemption Confirmation screens. `RewardsScreen.tsx`
carries a header comment saying so. If the plan is ever upgraded and
`4016:192` gets drawn, that file is what to reconcile against it.

One deliberate divergence from the Figma file's conventions: the file
builds a separate frame per state (there are 3 "Redemption Confirmation
Screen" frames), and last session's plan followed that for the no-phone
and post-submit cases. In code these are states of one screen sharing the
same balance hero — a canvas-organisation convention shouldn't dictate
app structure.

### Still not built

The **notification when a payout is confirmed** (gap 2 in
`docs/rewards-program.md`). There is still no push infrastructure
anywhere in this repo. A user has no way to learn their request was
processed except by noticing the Wish Money transfer. Unchanged by this
work.

Also unchanged: the User App has no auth screens, so the Rewards screen's
signed-out state says so plainly rather than rendering a sign-in button
that goes nowhere.

## Environment finding: iCloud eviction breaks the Metro build

`npx expo export` failed twice with
`Error: ETIMEDOUT: connection timed out, read` on `readFileSync` of
`metro-resolver/src/resolve.js` — a **local** file. Not a code error, and
not obviously a network error either, which is what makes it worth
recording.

Root cause: this repo lives under `~/Desktop`, which is covered by iCloud
Drive's Desktop & Documents sync. iCloud had **evicted file contents to
the cloud**, leaving metadata-only stubs. `ls -lO` shows the giveaway flag:

```
-rw-r--r-- 1 mac staff hidden,compressed,dataless 18143 resolve.js
```

`ls` and `wc -c` report the size from metadata and look fine; any actual
read triggers an on-demand download, which was timing out. **1437 files
in `node_modules` were in this state**, 920 of them code files.

Fix applied:

```bash
find node_modules -type f -print0 | xargs -0 ls -lO | grep dataless   # find them
brctl download <path>                                                  # materialize each
```

After materializing the 920 code files, the export succeeded. This will
recur — iCloud re-evicts whatever it likes whenever disk pressure
suggests it. The durable fixes, in order of preference: move the repo off
the iCloud-synced `~/Desktop` (e.g. `~/dev/zabetna-live`), or turn off
Desktop & Documents sync, or keep re-running the `brctl download` loop
above whenever a build fails with `ETIMEDOUT` on a local path. A plain
`pnpm install --force` also works but re-downloads everything.

## Open decisions for Mo

1. **Upgrade Figma to Professional (Full/Dev seat)?** Only way to design
   the remaining ~20 screens in Figma first. Otherwise the process
   inverts: build in code from the extracted tokens, and treat the Figma
   file as a record of the screens that were designed before the limit.
2. **Move the repo off `~/Desktop`?** Prevents the build failure above
   from recurring.
