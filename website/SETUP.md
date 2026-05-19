# Website Setup

This site is built from `website/` and deployed by `.github/workflows/deploy-website.yml`.

## GitHub Pages

1. Open the repository on GitHub.
2. Go to `Settings` -> `Pages`.
3. Set `Build and deployment` source to `GitHub Actions`.
4. Push to `main` or run the `Deploy Website` workflow manually.
5. The public URL should be:
   `https://ivicaskrobo.github.io/Bili-Mushroom/`

## Repository Variables

Open `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`, then add the public values the website should bake into the static build:

| Variable | Purpose |
| --- | --- |
| `VITE_GISCUS_REPO` | Usually `IvicaSkrobo/Bili-Mushroom`. |
| `VITE_GISCUS_REPO_ID` | Repository ID from the Giscus setup page. |
| `VITE_GISCUS_CATEGORY` | Discussion category name, for example `General` or `Announcements`. |
| `VITE_GISCUS_CATEGORY_ID` | Category ID from the Giscus setup page. |
| `VITE_BUG_REPORT_URL` | Optional bug form URL. If empty, the website uses the public GitHub bug issue template. Use Tally, Google Forms, Formspree, or another private inbox later if needed. |
| `VITE_DONATE_URL` | Donate page URL, for example Ko-fi, Buy Me a Coffee, PayPal, or Stripe Payment Link. |

These are public website values, not secrets. Do not put private API keys here because Vite embeds them into the generated static files.

## Giscus

1. Enable `Settings` -> `Features` -> `Discussions`.
2. Install the Giscus app for the repository if GitHub asks for it.
3. Go to `https://giscus.app/`.
4. Enter `IvicaSkrobo/Bili-Mushroom`.
5. Choose the discussion category for release comments.
6. Copy `data-repo-id` into `VITE_GISCUS_REPO_ID`.
7. Copy `data-category-id` into `VITE_GISCUS_CATEGORY_ID`.

## Ideas and Voting

Feature ideas use GitHub issues with the `idea` label.

1. Create a repository label named `idea`.
2. Users can open ideas from the website.
3. Users vote with reactions on the issue.
4. The website reads open issues with `label:idea` and shows the first 10.
5. Popular ideas can later be copied into the donation/funding goals.

## Bug Reports

The website works immediately with the public GitHub bug issue template:

`https://github.com/IvicaSkrobo/Bili-Mushroom/issues/new?template=bug_report.yml&labels=bug`

The public bug board lives at:

`https://ivicaskrobo.github.io/Bili-Mushroom/?lang=hr#bugs`

It reads open GitHub issues with the `bug` label and shows title, issue number, comments, and link. Do not put private contact details in public issue bodies.

Screenshots and logs can expose file paths or locations, so the website copy reminds users to check attachments before posting.

If a private inbox is needed later, good first options are:


- Tally form
- Google Form
- Formspree form
- GitHub private repository issue form

After choosing one, set `VITE_BUG_REPORT_URL` to that form URL and redeploy the website.

## Donate

Good first options:

- Ko-fi
- Buy Me a Coffee
- PayPal.me
- Stripe Payment Link

After choosing one, set `VITE_DONATE_URL` and redeploy.
