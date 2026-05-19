# Gljivobook Roadmap

## Website and App Support Phase

- Keep donate controls hidden until a real payment link is configured.
- Set up a donation provider and create the final public donation URL.
- Add the URL as `VITE_DONATE_URL` in GitHub repository variables for both website and app builds.
- Run a release build and verify that the donate button appears in the app and on the website.
- Reminder for this phase: Ivica needs to choose and configure the payment/donation account before we enable the button.

## Website Polish Phase

Can be handled without Ivica:

- Reduce website copy so the page scans faster.
- Improve the desktop structure around download, app preview, screenshots, changelog, community, and bug board.
- Improve the mobile layout and spacing from top to bottom.
- Replace abstract screenshot placeholders with polished app-preview panels that reflect Collection, Species, Map, and Find entry.
- Keep the bug board hidden from main navigation, but reachable by direct `#bugs` URL.
- Keep the website visually close to the app: dark default, Forest Codex colors, Cormorant species names, amber/green accents.

Needs Ivica later:

- Real screenshots from the installed app if we want exact production imagery instead of designed preview panels.
- Donation provider setup and final payment URL.
- Any public wording that needs legal review beyond the current friendly disclaimer.

## Backlog That Needs Ivica

- Provide exact production screenshots if the website should show real app captures instead of designed previews.
- Choose final donation/payment provider and finish account setup.
- Decide whether the public website should mention donation funding goals again after the provider is ready.
- Review final public disclaimer text if it should be stricter or legally polished.
- Decide whether the bug board should stay as a hidden direct URL or move into a more private workflow later.

## Website Real Screenshots Phase

Goal: replace the designed preview panels with real app screenshots where they make the website clearer.

Ivica provides:

- A screenshot of the Collection/Zbirka view with a few normal species folders visible.
- A screenshot of the Species/Vrste view with one nice species selected.
- A screenshot of the Map/Karta view with several pins and one popup or selected pin.
- A screenshot of Add Find/Novi nalaz or Import Photos/Uvezi fotografije with clean example data.
- Optional: one Stats/Statistike screenshot if it looks strong enough for the website hero or feature section.

Codex will:

- Pick the best screenshots with Ivica and decide which ones belong in hero vs feature sections.
- Crop/resize/compress them for website use.
- Blur or crop anything too personal if needed.
- Keep HR and EN website text around the same image assets unless separate language screenshots are worth it.
- Fall back to designed preview panels for any app area where the screenshot is too busy or not polished.
