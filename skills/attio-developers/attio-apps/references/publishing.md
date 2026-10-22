# Publishing and sharing

Read this file when the user wants to share an app, ship an update, or prepare it for the App
Store. Most steps happen in the Developer console, so get the code and README ready and tell the
user what to do there.

Docs: `/share/the-publication-lifecycle`, `/share/private-invites`, `/share/shipping-updates`,
`/share/publishing-to-the-app-store`, `/share/code-review`, `/share/app-listings`.

- Run `attio version create` only when the user asks to release.
- A private app moves every install to the new version at once. Check first that no published id,
  config key, outcome id or settings key was renamed or removed.
- Before App Store submission, run `review-checklist.md` over the whole app and the full
  validation ladder, and keep the README's setup steps in sync with the listing's Configure
  section.
