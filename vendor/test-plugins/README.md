# Authorized installed plugin test bundles

These files were freshly collected from the user's installed vault plugins under
explicit test authorization. Only main.js, manifest.json and styles.css are
included. data.json, credentials, task data and user configuration are excluded.

The installed bundles include Chinese localization, `nosourcemap` comments and an
AutoMover route-v3 customization. They therefore intentionally differ from public
release bytes. `docs/plugin-combination.json` pins the actual collected bytes.

Each directory retains its upstream license. These are separate test components;
they are never bundled, linked or distributed in the observatory plugin ZIP.
TaskNotes, Dataview, QuickAdd, Templater, AnyBlock and AutoMover remain attributed
to the upstream repositories recorded in that catalog. Our root MIT license does
not replace their licenses. No tests execute user-configured macros or templates.

Test-only plugin combination: the authorized installed program bundles are retained in vendor/test-plugins. Templater 2.25.0 and Any Block 3.5.3 are independently licensed AGPL-3.0 programs. Their full corresponding upstream source archives, build scripts and licenses are included beside each bundle, at commits recorded in plugin-combination.json. The installed main.js differs from the matching upstream release only by an appended /* nosourcemap */ comment; no program behavior patch is required. These independent test plugins and source archives are excluded from the observatory distribution. Other test bundles retain their respective MIT notices; Dataview/QuickAdd localization and AutoMover route-v3 customization are authorized installed variants. No private configuration is included.