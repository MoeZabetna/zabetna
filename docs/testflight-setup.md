# Getting both apps onto TestFlight

Everything that can be prepared from this repo is prepared. What remains
needs credentials only Mo has — an Apple Developer account and an Expo
account — so these are the exact steps to run, in order, with the reasoning
for anything non-obvious.

## What's already done

- **Bundle identifiers set**: `com.zabetna.userapp` and
  `com.zabetna.shopapp`. Both apps had scaffold identities until
  2026-09-03 (`name: "user-app"`, `slug: "user-app"`, no bundle id) — those
  would have been the names on the App Store listing and the TestFlight
  tile. They are now "Zabetna" and "Zabetna Shop".
- **`eas.json` in both apps**, with `development`, `preview` and
  `production` profiles.
- **Supabase env vars are baked into every build profile.** This matters:
  EAS builds run on Expo's servers, which do not have the gitignored
  `.env`, and both apps `throw` at startup without those two variables.
  Shipping a TestFlight build that crashes on launch for exactly that
  reason is not hypothetical here — it is root cause 5 of
  `docs/incidents/2026-08-30-admin-panel-outage.md`, the same mistake in a
  different deploy target. The anon key is publishable and designed to sit
  in a client bundle; it is not the service role key.
- Both apps verified with `tsc --noEmit` and `expo export`.

## What you need before starting

1. **An Apple Developer Program membership** ($99/year). TestFlight is not
   available without it. If the account doesn't exist yet, enrolment can
   take 24-48 hours for individuals and longer for organisations — worth
   starting first.
2. **An Expo account** (free) for EAS Build.
3. `eas-cli`: `npm install -g eas-cli`

## Steps

Run these from each app directory. Do the User App first; the Shop App is
the same sequence.

```bash
npm install -g eas-cli
eas login                       # Expo account

cd apps/user-app
eas init                        # links this app to an EAS project, writes extra.eas.projectId
eas build --platform ios --profile production
```

`eas build` asks about signing credentials on the first run. Choosing
"let EAS handle it" is the sane default — it creates the distribution
certificate and provisioning profile in your Apple account for you. It will
prompt for the Apple ID and, if the App Store Connect app record doesn't
exist yet, offer to create it.

A build takes roughly 15-30 minutes on EAS's queue. When it finishes:

```bash
eas submit --platform ios --latest
```

That uploads the build to App Store Connect. It then sits in
"Processing" for another 10-30 minutes before appearing in TestFlight.

Then repeat for the Shop App:

```bash
cd ../restaurant-app
eas init
eas build --platform ios --profile production
eas submit --platform ios --latest
```

### Adding testers

In App Store Connect → your app → TestFlight:

- **Internal testing** (up to 100 people, no review, available in minutes)
  is what you want for this round. Add testers by their Apple ID email
  under Users and Access first, then add them to an internal group.
- **External testing** (up to 10,000) requires a Beta App Review, usually
  a day or two. Not needed to test with your own team.

Both apps need a "What to test" note and a contact email before a build can
be distributed, even internally.

## `eas init` also fixes push notifications

`registerForPush` in the User App currently returns a `skipped` reason —
"No EAS project id" — because `getExpoPushTokenAsync` cannot mint a token
without one. Running `eas init` populates `extra.eas.projectId` and that
stops being true, so real push tokens start being registered on the first
TestFlight install.

The remaining half of push delivery is invoking `send-push`: create a
Database Webhook in the Supabase dashboard on `notifications` INSERT
pointing at the function's URL, with the service role key in the
Authorization header. Until then the in-app inbox works and push does not —
see `docs/2026-09-02-user-app-build.md`.

## Faster alternative for this round of testing

TestFlight is the right answer for real-device testing by people who
aren't developers. It is *not* the fastest way to check that the three
surfaces are in sync, which is the immediate goal.

```bash
pnpm user-app          # then scan the QR with Expo Go
pnpm restaurant-app
```

Both apps run in **Expo Go** today, on any phone on the same network, with
no Apple account and no build queue. Two caveats:

- **Push notifications don't work in Expo Go on iOS** (Expo removed that in
  SDK 53). The in-app notification inbox works fine, which covers the
  payout-confirmation flow end to end.
- The Shop App's camera scanning needs a real device; the simulator has no
  camera. Expo Go on a physical phone is fine.

If you want device builds without the App Store round trip, the
`preview` profile produces an internal-distribution build you can install
directly:

```bash
eas build --platform ios --profile preview
```

That still needs the Apple Developer account (for signing), but skips App
Store Connect and the processing wait.

## Not done, deliberately

**Both apps still ship the default Expo icon and splash screen.** They will
appear on the TestFlight tile and the home screen exactly as they are now —
a generic placeholder. Making a real icon is a design decision, and the
brand mark in Figma is a six-layer gradient composition with a wordmark in
a font this repo has no copy of, so it needs deciding rather than guessing.
Worth sorting before anyone outside the team sees a build.
