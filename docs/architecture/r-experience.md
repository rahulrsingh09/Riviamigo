# R experience integration

## Ownership

This private fork exposes R (the approved Option B) as its only interface.
There is no user-facing interface switch. Retained upstream source supports
updates and compatibility tests; it does not allocate another deployed service.
R compiles into the existing web app, not a plugin server or separate host.

`apps/web/src/features/r-experience` owns composition, navigation, settings
discovery, the vehicle stage, motion and scoped CSS. Existing hooks own auth,
account preferences, vehicle selection, cache keys and API transport. Existing
dashboard/settings controllers retain editing, permissions, queries and mutations.
The canonical bundled-chart renderer is unchanged. Only analytics matching the
bundled widget geometry use compact R spacing. Personal layouts, administrator
edits to system layouts, and editing mode retain saved positions and sizes.

| Shared seam | Purpose |
| --- | --- |
| `routes/__root.tsx` | Apply R across routes, authentication and portals |
| `components/layout/AppLayout.tsx` | Export R under the existing layout contract |
| `components/layout/vehicleConnection.ts` | Neutral helpers shared with retained upstream layout |
| `components/dashboard/DashboardPageShell.tsx` | Pass existing state/actions to R composition |
| `components/dashboard/dashboardShellTypes.ts` | Shared types without a module/controller cycle |
| `features/settings/SettingsPage.tsx` | R directory around existing sections and authority |
| Health and chart editor composition | R identity while preserving workflows |
| `routes/settings.themes.$themeId.tsx` | Redirect retired appearance URLs |
| Card, PageLayout, MetricTabs and WidgetHost attributes | Stable styling hooks |
| `packages/ui/src/tokens/globals.css` | R overrides in the canonical token owner |
| TripMapChart and trip-detail composition | Optional point inspection; proxy policy unchanged |

The overview uses actual existing metrics, trips, charging and vehicle status.
Selected-vehicle identity and placeholder checks prevent displaying another
vehicle's cached readings. Missing readings remain unknown, not zero. The full
editable dashboard remains at `/d/dashboard`, as a data workspace within R.

## Routes and settings

Primary navigation has Overview, Trips, Charging, Efficiency and Explore.
Explore links to Vehicle health, Battery, dashboard library, all settings and
permission-gated account administration.

Settings retain Vehicles, Dashboards, Charts, Units & time, Places, Charging,
External connections, API access, Jobs, Raw data, Backups, Account and
Authentication. Existing roles determine availability. Map controls move to
Units & time. `?section=appearance` opens Units & time; `/settings/themes/:id`
redirects to the directory. Stored theme records and light/dark preference remain
compatible with upstream, but R overrides the interface palette and exposes no
theme chooser.

The R route-coverage contract enumerates every registered route, including auth,
focused editors and compatibility URLs. An upstream route addition requires a
coverage decision. Browser tests exercise the normal shell, focused chart
editing, map inspection and authentication separately.

## Artwork and motion

Matching R2 Performance/Catalina Cove metadata uses the approved artwork with
21-inch wheels and black interior. Other vehicles use the existing authenticated
artwork resolver and fallback. Artwork is presentation, not a live sensor reading.

The poster is approximately 153 KB. The 72-frame rotation pack is 3,460,102 bytes,
fetched once per document on interaction (or restoration of an angle already
selected in that document). Six decoded frames are retained per mounted viewer.
Images and animation frames are released on exit; fast drags draw the latest
requested frame. Failed loads stop motion until another explicit attempt.

There is no CDN, remote model request or new animation dependency. Assets use
the existing app origin/security policy. Reduced motion removes inertia.

## Security and cost boundaries

API private-deployment modules, private gateway, database catalog adapter,
origin gate and release guards do not depend on R. R adds no credentials,
endpoints, permissions, migrations, workers, databases or cloud services.
No free-tier policy exception is added.

Retaining source does not allocate another service. Asset transfer still counts
against existing request/egress usage. Rotation is deferred; authenticated
gateway caching is unchanged, so reloads can transfer assets again. This is not
a claim of unlimited free bandwidth. Actual allocation must pass the unchanged
Northflank `free_policy` and billing checks before deployment; a local build does
not prove future billing will stay zero.

## Upstream synchronization

Use the existing fork-upstream-sync, candidate CI and protected promotion path.
Do not use automatic “prefer ours” merge drivers. The sync gate stops when
upstream touches any fork-modified path, even if Git can merge the text. Module
isolation reduces overlap; shared seams still need review.

1. Fetch upstream and identify the exact candidate; skip integrated commits.
2. Inspect overlap at the UI and security seams.
3. Preserve upstream auth, cache scoping, canonical charts and settings behavior.
4. Run build, package/script tests, browser/route coverage, color/dependency and
   security-route checks, plus unchanged deployment guards.
5. Review desktop/mobile, dark/light and failure-path behavior.
6. Promote only through existing protected CI and verified release.

Deployment is a separate action after review. The existing frontend CI job runs the full browser suite, with no new CI job
or deployment resource. The sync and promotion policy is unchanged.
