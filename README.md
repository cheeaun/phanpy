<div align="center">
  <img src="design/logo-4.svg" width="128" height="128" alt="">

Phanpy
===

**Minimalistic opinionated Mastodon web client.**
</div>

![Fancy screenshot](readme-assets/fancy-screenshot.jpg)

**🗣️ Pronunciation**: [`/fænpi/`](https://ythi.net/how-do-you-pronounce/phanpy/english/) ([`FAN-pee`](https://www.smogon.com/forums/threads/the-official-name-pronunciation-guide.3474941/)) [🔊 Listen](https://www.youtube.com/watch?v=DIUbWe-ysJI)

This is an alternative web client for [Mastodon](https://joinmastodon.org/).

- 🏢 **Production**: https://phanpy.social
  - `production` branch
  - break less often
  - slower fixes unless critical
- 🏗️ **Development**: https://dev.phanpy.social
  - `main` branch
  - may see new cool stuff sooner
  - may break more often
  - may be fixed much faster too

🐘 Follow [@phanpy on Mastodon](https://hachyderm.io/@phanpy) for updates ✨

Everything is designed and engineered following my taste and vision. This is a personal side project for me to learn about Mastodon and experiment with new UI/UX ideas.

## Features

- 👪 Multiple accounts
- 🪟 Compose window pop-out/in
- 🌗 Light/dark/auto theme
- 🔔 Grouped notifications
- 🪺 Nested comments thread
- 📬 Unsent draft recovery
- 🎠 Boosts Carousel™️
- ⚡ Shortcuts™️ with view modes like multi-column or tab bar
- #️⃣ Multi-hashtag timeline

## Design decisions

- **Status actions (reply, boost, favourite, bookmark, etc) are hidden by default**.<br>They only appear in individual status page. This is to reduce clutter and distraction. It may result in lower engagement, but we're not chasing numbers here.
- **Boost is represented with the rocket icon**.<br>The green double arrow icon (retweet for Twitter) doesn't look right for the term "boost". Green rocket looks weird, so I use purple.
- **Short usernames (`@username`) are displayed in timelines, instead of the full account username (`@username@instance`)**.<br>Despite the [guideline](https://docs.joinmastodon.org/api/guidelines/#username) mentioned that "Decentralization must be transparent to the user", I don't think we should shove it to the face every single time. There are also some [screen-reader-related accessibility concerns](https://twitter.com/lifeofablindgrl/status/1595864647554502656) with the full username, though this web app is unfortunately not accessible yet.
- **No autoplay for video/GIF/whatever in timeline**.<br>The timeline is already a huge mess with lots of people, brands, news and media trying to grab your attention. Let's not make it worse. (Current exception now would be animated emojis.)
- **Hash-based URLs**.<br>This web app is not meant to be a full-fledged replacement to Mastodon's existing front-end. There's no SEO, database, serverless or any long-running servers. I could be wrong one day.

## Subtle UI implementations

### User name display

![User name display](readme-assets/user-name-display.jpg)

- On the timeline, the user name is displayed as `[NAME] @[username]`.
- For the `@[username]`, always exclude the instance domain name.
- If the `[NAME]` *looks the same* as the `@[username]`, then the `@[username]` is excluded as well.

### Boosts Carousel

![Boosts Carousel](readme-assets/boosts-carousel.jpg)

- From the fetched posts (e.g. 20 posts per fetch), if number of boosts are more than quarter of total posts or more than 3 consecutive boosts, boosts carousel UI will be triggered.
- If number of boosts are more than 3 quarters of total posts, boosts carousel UI will be slotted at the end of total posts fetched (per "page").
- Else, boosts carousel UI will be slotted in between the posts.

### Thread number badge (e.g. Thread 1/X)

![Thread number badge](readme-assets/thread-number-badge.jpg)

- Check every post for `inReplyToId` from cache or additional API requests, until the root post is found.
- If root post is found, badge will show the index number of the post in the thread.
- Limit up to 3 API requests as the root post may be very old or the thread is super long.
- If index number couldn't be found, badge will fallback to showing `Thread` without the number.

### Hashtag stuffing collapsing

![Hashtag stuffing collapsing](readme-assets/hashtag-stuffing-collapsing.jpg)

- First paragraph of post content with more than 3 hashtags will be collapsed to max 3 lines.
- Subsequent paragraphs after first paragraph with more than 3 hashtags will be collapsed to 1 line.
- Adjacent paragraphs with more than 1 hashtag after collapsed paragraphs will be collapsed to 1 line.
- If there are text around or between the hashtags, they will not be collapsed.
- Collapsed hashtags will be appended with `...` at the end.
- They are also slightly faded out to reduce visual noise.
- Opening the post view will reveal the hashtags uncollapsed.

### Filtered posts

- "Hide completely"-filtered posts will be hidden, with no UI to reveal it.
- "Hide with a warning"-filtered posts will be partially hidden, showing the filter name and author name.
  - Content can be partially revealed by hovering over the post, with tooltip showing the post text.
  - Clicking it will open the Post page.
  - Long-pressing or right-clicking it will "peek" the post with a bottom sheet UI.
  - On boosts carousel, they are sorted to the end of the carousel.

## Development

Prerequisites: Node.js 18+

- `npm install` - Install dependencies
- `npm run dev` - Start development server and `messages:extract` (`clean` + ``watch`) in parallel
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run fetch-instances` - Fetch instances list from [joinmastodon.org/servers](https://joinmastodon.org/servers), save it to `src/data/instances.json`
- `npm run sourcemap` - Run `source-map-explorer` on the production build
- `npm run messages:extract` - Extract messages from source files and update the locale message catalogs

## Tech stack

- [Vite](https://vitejs.dev/) - Build tool
- [Preact](https://preactjs.com/) - UI library
- [Valtio](https://valtio.pmnd.rs/) - State management
- [React Router](https://reactrouter.com/) - Routing
- [masto.js](https://github.com/neet/masto.js/) - Mastodon API client
- [Iconify](https://iconify.design/) - Icon library
  - [MingCute icons](https://www.mingcute.com/)
- [Lingui](https://lingui.dev/) - Internationalization
- Vanilla CSS - _Yes, I'm old school._

Some of these may change in the future. The front-end world is ever-changing.

## Internationalization

All translations are available as [gettext](https://en.wikipedia.org/wiki/Gettext) `.po` files in the `src/locales` folder. The default language is English (`en`). [CLDR Plural Rules](https://cldr.unicode.org/index/cldr-spec/plural-rules) are used for pluralization. RTL (right-to-left) languages are also supported with proper text direction, icon rendering and layout.

On page load, default language is detected via these methods, in order (first match is used):

1. URL parameter `lang` e.g. `/?lang=zh-Hant`
2. `localStorage` key `lang`
3. Browser's `navigator.language`

Users can change the language in the settings, which sets the `localStorage` key `lang`.

### Guide for translators

*Inspired by [Translate WordPress Handbook](https://make.wordpress.org/polyglots/handbook/):

- [Don’t translate literally, translate organically](https://make.wordpress.org/polyglots/handbook/translating/expectations/#dont-translate-literally-translate-organically).
- [Try to keep the same level of formality (or informality)](https://make.wordpress.org/polyglots/handbook/translating/expectations/#try-to-keep-the-same-level-of-formality-or-informality)
- [Don’t use slang or audience-specific terms](https://make.wordpress.org/polyglots/handbook/translating/expectations/#try-to-keep-the-same-level-of-formality-or-informality)
- Be attentive to placeholders for variables. Many strings have placesholders e.g. `{account}` (variable), `<0>{name}</0>` (tag with variable) and `#` (number placeholder).
- [Ellipsis](https://en.wikipedia.org/wiki/Ellipsis) (…) is intentional. Don't remove it.
  - Nielsen Norman Group: ["Include Ellipses in Command Text to Indicate When More Information Is Required"](https://www.nngroup.com/articles/ui-copy/)
  - Apple Human Interface Guidelines: ["Append an ellipsis to a menu item’s label when the action requires more information before it can complete. The ellipsis character (…) signals that people need to input information or make additional choices, typically within another view."](https://developer.apple.com/design/human-interface-guidelines/menus)
  - Windows App Development: ["Ellipses mean incompleteness."](https://learn.microsoft.com/en-us/windows/win32/uxguide/text-ui)
- Date timestamps, date ranges, numbers, language names and text segmentation are handled by the [ECMAScript Internationalization API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl).
  - [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) - e.g. "8 Aug", "08/08/2024"
  - [`Intl.RelativeTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat) - e.g. "2 days ago", "in 2 days"
  - [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) - e.g. "1,000", "10K"
  - [`Intl.DisplayNames`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames) - e.g. "English" (`en`) in Traditional Chinese (`zh-Hant`) is "英文"
  - [`Intl.Locale`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale) (with polyfill for older browsers)
  - [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) (with polyfill for older browsers)

### Technical notes

- IDs for strings are auto-generated instead of explicitly defined. Some of the [benefits](https://lingui.dev/tutorials/explicit-vs-generated-ids#benefits-of-generated-ids) are avoiding the "naming things" problem and avoiding duplicates.
  - Explicit IDs might be introduced in the future when requirements and priorities change. The library (Lingui) allows both.
  - Please report issues if certain strings are translated differently based on context, culture or region.
- There are no strings for push notifications. The language is set on the instance server.
- Native HTML date pickers, e.g. `<input type="month">` will always follow the system's locale and not the user's set locale.
- "ALT" in ALT badge is not translated. It serves as a a recognizable standard across languages.
- Custom emoji names are not localized, therefore searches don't work for non-English languages.
- GIPHY API supports [a list of languages for searches](https://developers.giphy.com/docs/optional-settings/#language-support).
- Unicode Right-to-left mark (RLM) (`U+200F`, `&rlm;`) may need to be used for mixed RTL/LTR text, especially for [`<title>` element](https://www.w3.org/International/questions/qa-html-dir.en.html#title_element) (`document.title`).
- On development, there's an additional `pseudo-LOCALE` locale, used for [pseudolocalization](https://en.wikipedia.org/wiki/Pseudolocalization). It's for testing and won't show up on production.
- When building for production, English (`en`) catalog messages are not bundled separatedly. Other locales are bundled as separate files and loaded on demand. This ensures that `en` is always available as fallback.

### Volunteer translations

[![Crowdin](https://badges.crowdin.net/phanpy/localized.svg)](https://crowdin.com/project/phanpy)

Translations are managed on [Crowdin](https://crowdin.com/project/phanpy). You can help by volunteering translations.

Read the [intro documentation](https://support.crowdin.com/for-volunteer-translators/) to get started.

## Self-hosting

This is a **pure static web app**. You can host it anywhere you want.

Two ways (choose one):

### Easy way

Go to [Releases](https://github.com/cheeaun/phanpy/releases) and download the latest `phanpy-dist.zip` or `phanpy-dist.tar.gz`. It's pre-built so don't need to run any install/build commands. Extract it. Serve the folder of extracted files.

### Custom-build way

Requires [Node.js](https://nodejs.org/).

Download or `git clone` this repository. Use `production` branch for *stable* releases, `main` for *latest*. Build it by running `npm run build` (after `npm install`). Serve the `dist` folder.

Customization can be done by passing environment variables to the build command. Examples:

```bash
PHANPY_CLIENT_NAME="Phanpy Dev" \
    PHANPY_WEBSITE="https://dev.phanpy.social" \
    npm run build
```

```bash
PHANPY_DEFAULT_INSTANCE=hachyderm.io \
    PHANPY_DEFAULT_INSTANCE_REGISTRATION_URL=https://hachyderm.io/auth/sign_up \
    PHANPY_PRIVACY_POLICY_URL=https://hachyderm.io/privacy-policy \
    npm run build
```

It's also possible to set them in the `.env` file.

Available variables:

- `PHANPY_CLIENT_NAME` (optional, default: `Phanpy`) affects:
  - Web page title, shown in the browser window or tab title
  - App title, when installed as PWA, shown in the Home screen, macOS dock, Windows taskbar, etc
  - OpenGraph card title, when shared on social networks
  - Client name, when [registering the app for authentication](https://docs.joinmastodon.org/client/token/#app) and shown as client used on posts in some apps/clients
- `PHANPY_WEBSITE` (optional but recommended, default: `https://phanpy.social`) affects:
  - Canonical URL of the website
  - OpenGraph card URL, when shared on social networks
  - Root path for the OpenGraph card image
  - Client URL, when [registering the app for authentication](https://docs.joinmastodon.org/client/token/#app) and shown as client used on posts in some apps/clients
- `PHANPY_DEFAULT_INSTANCE` (optional, no defaults):
  - e.g. 'mastodon.social', without `https://`
  - Default instance for log-in
  - When logging in, the user will be redirected instantly to the instance's authentication page instead of having to manually type the instance URL and submit
- `PHANPY_DEFAULT_INSTANCE_REGISTRATION_URL` (optional, no defaults):
  - URL of the instance registration page
  - E.g. `https://mastodon.social/auth/sign_up`
- `PHANPY_PRIVACY_POLICY_URL` (optional, default to official instance's privacy policy):
  - URL of the privacy policy page
  - May specify the instance's own privacy policy
- `PHANPY_DEFAULT_LANG` (optional):
  - Default language is English (`en`) if not specified.
  - Fallback language after multiple detection methods (`lang` query parameter, `lang` key in `localStorage` and `navigator.language`)
- `PHANPY_LINGVA_INSTANCES` (optional, space-separated list, default: `lingva.phanpy.social [...hard-coded list of fallback instances]`):
  - Specify a space-separated list of instances. First will be used as default before falling back to the subsequent instances. If there's only 1 instance, means no fallback.
  - May specify a self-hosted Lingva instance, powered by either [lingva-translate](https://github.com/thedaviddelta/lingva-translate) or [lingva-api](https://github.com/cheeaun/lingva-api)
  - List of fallback instances hard-coded in `/.env`
  - [↗️ List of lingva-translate instances](https://github.com/thedaviddelta/lingva-translate?tab=readme-ov-file#instances)
- `PHANPY_IMG_ALT_API_URL` (optional, no defaults):
  - API endpoint for self-hosted instance of [img-alt-api](https://github.com/cheeaun/img-alt-api).
  - If provided, a setting will appear for users to enable the image description generator in the composer. Disabled by default.
- `PHANPY_GIPHY_API_KEY` (optional, no defaults):
  - API key for [GIPHY](https://developers.giphy.com/). See [API docs](https://developers.giphy.com/docs/api/).
  - If provided, a setting will appear for users to enable the GIF picker in the composer. Disabled by default.
  - This is not self-hosted.

### Static site hosting

Try online search for "how to self-host static sites" as there are many ways to do it.

#### Lingva-translate or lingva-api hosting

See documentation for [lingva-translate](https://github.com/thedaviddelta/lingva-translate) or [lingva-api](https://github.com/cheeaun/lingva-api).

## Community deployments

These are self-hosted by other wonderful folks.

- [ferengi.one](https://m.ferengi.one/) by [@david@weaknotes.com](https://weaknotes.com/@david)
- [phanpy.blaede.family](https://phanpy.blaede.family/) by [@cassidy@blaede.family](https://mastodon.blaede.family/@cassidy)
- [phanpy.mstdn.mx](https://phanpy.mstdn.mx/) by [@maop@mstdn.mx](https://mstdn.mx/@maop)
- [phanpy.vmst.io](https://phanpy.vmst.io/) by [@vmstan@vmst.io](https://vmst.io/@vmstan)
- [phanpy.gotosocial.social](https://phanpy.gotosocial.social/) by [@admin@gotosocial.social](https://gotosocial.social/@admin)
- [phanpy.bauxite.tech](https://phanpy.bauxite.tech) by [@b4ux1t3@hachyderm.io](https://hachyderm.io/@b4ux1t3)
- [phanpy.hear-me.social](https://phanpy.hear-me.social) by [@admin@hear-me.social](https://hear-me.social/@admin)
- [phanpy.fulda.social](https://phanpy.fulda.social) by [@Ganneff@fulda.social](https://fulda.social/@Ganneff)
- [phanpy.crmbl.uk](https://phanpy.crmbl.uk) by [@snail@crmbl.uk](https://mstdn.crmbl.uk/@snail)
- [halo.mookiesplace.com](https://halo.mookiesplace.com) by [@mookie@mookiesplace.com](https://mookiesplace.com/@mookie)
- [social.qrk.one](https://social.qrk.one) by [@kev@fosstodon.org](https://fosstodon.org/@kev)
- [phanpy.cz](https://phanpy.cz) by [@zdendys@mamutovo.cz](https://mamutovo.cz/@zdendys)
- [phanpy.social.tchncs.de](https://phanpy.social.tchncs.de) by [@milan@social.tchncs.de](https://social.tchncs.de/@milan)

> Note: Add yours by creating a pull request.

## Costs

Costs involved in running and developing this web app:

- Domain name (.social): **USD$23.18/year** (USD$6.87 1st year)
- Hosting: Free
- Development, design, maintenance: "Free" (My precious time)

## Mascot

[Phanpy](https://bulbapedia.bulbagarden.net/wiki/Phanpy_(Pok%C3%A9mon)) is a Ground-type Pokémon.

## Maintainers + contributors

- [Chee Aun](https://github.com/cheeaun) ([Mastodon](https://mastodon.social/@cheeaun)) ([Twitter](https://twitter.com/cheeaun))

[![Contributors](https://contrib.rocks/image?repo=cheeaun/phanpy)](https://github.com/cheeaun/phanpy/graphs/contributors)

### Translation volunteers

<!-- i18n volunteers start -->
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/12571163/medium/9f3ea938f4243f5ffe2a43f814ddc9e8_default.png" alt="" width="16" height="16" /> alidsds11 (Arabic)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16180744/medium/5b04ae975b23895635130d7a176515cb_default.png" alt="" width="16" height="16" /> alternative (Korean)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/13170041/medium/603136896af17fc005fd592ce3f48717_default.png" alt="" width="16" height="16" /> BoFFire (Arabic, French, Kabyle)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/12898464/medium/d3758a76b894bade4bf271c9b32ea69b.png" alt="" width="16" height="16" /> Brawaru (Russian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15460040/medium/1cfcfe5f5511b783b5d9f2b968bad819.png" alt="" width="16" height="16" /> cbasje (Dutch)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15525631/medium/51293156034d0236f1a1020c10f7d539_default.png" alt="" width="16" height="16" /> cbo92 (French)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15910131/medium/67fab7eeab5551853450e76e2ef19e59.jpeg" alt="" width="16" height="16" /> CDN (Chinese Simplified)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16556801/medium/ed5e501ca1f3cc6525d2da28db646346.jpeg" alt="" width="16" height="16" /> dannypsnl (Chinese Traditional)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/3711/medium/d95ddd44e8dcb3a039f8a3463aed781d_default.png" alt="" width="16" height="16" /> databio (Catalan)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16533843/medium/ac7af8776858a992d992cf6702d1aaae.jpg" alt="" width="16" height="16" /> Dizro (Italian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16574625/medium/f2ac3a4f32f104a3a6d4085d4bcb3924_default.png" alt="" width="16" height="16" /> Drift6944 (Czech)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/12618120/medium/ccb11bd042bbf4c7189033f7af2dbd32_default.png" alt="" width="16" height="16" /> drydenwu (Chinese Traditional)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/13557465/medium/8feebf3677fa80c01e8c54c4fbe097e0_default.png" alt="" width="16" height="16" /> elissarc (French)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16528627/medium/9036f6eced0257f4e1ea4c5bd499de2d_default.png" alt="" width="16" height="16" /> ElPamplina (Spanish)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/14277386/medium/29b30d2c73a214000e3941c9978f49e4_default.png" alt="" width="16" height="16" /> Fitik (Esperanto, Hebrew)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/14444512/medium/99d0e7a3076deccbdfe0aa0b0612308c.jpeg" alt="" width="16" height="16" /> Freeesia (Japanese)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/12617257/medium/a201650da44fed28890b0e0d8477a663.jpg" alt="" width="16" height="16" /> ghose (Galician)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15248754/medium/0dac6334ea0f4e8d4194a605c0a5594a.jpeg" alt="" width="16" height="16" /> hongminhee (Korean)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16529833/medium/2122d0c5d61c00786ab6d5e5672d4098.png" alt="" width="16" height="16" /> Hugoglyph (Esperanto, Spanish)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/13454728/medium/1f78b7124b3c962bc4ae55e8d701fc91_default.png" alt="" width="16" height="16" /> isard (Catalan)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16532403/medium/4cefb19623bcc44d7cdb9e25aebf5250.jpeg" alt="" width="16" height="16" /> karlafej (Czech)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15791971/medium/88bdda3090339f16f6083390d32bb434_default.png" alt="" width="16" height="16" /> katullo11 (Italian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/14677260/medium/e53420d200961f48602324e18c091bdc.png" alt="" width="16" height="16" /> Kytta (German)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16529521/medium/ae6add93a901b0fefa2d9b1077920d73.png" alt="" width="16" height="16" /> llun (Thai)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16291756/medium/2366972cc86287353708aff1ded3f3c1.jpg" alt="" width="16" height="16" /> lucasofchirst (Occitan, Portuguese, Portuguese, Brazilian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16537713/medium/825f0bf1a14fc545a76891a52839d86e_default.png" alt="" width="16" height="16" /> marcin.kozinski (Polish)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/13521465/medium/76cb9aa6b753ce900a70478bff7fcea0.png" alt="" width="16" height="16" /> mkljczkk (Polish)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/12882812/medium/77744d8db46e9a3e09030e1a02b7a572.jpeg" alt="" width="16" height="16" /> mojosoeun (Korean)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/13613969/medium/c7834ddc0ada84a79671697a944bb274.png" alt="" width="16" height="16" /> moreal (Korean)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/14158861/medium/ba1ff31dc5743b067ea6685f735229a5_default.png" alt="" width="16" height="16" /> MrWillCom (Chinese Simplified)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15652333/medium/7f36f289f9e2fe41d89ad534a1047f0e.png" alt="" width="16" height="16" /> nclm (French)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16539461/medium/2f41b9f0b802c1d200a6ab62167a7229_default.png" alt="" width="16" height="16" /> pazpi (Italian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15106977/medium/54bf93b19af8bbfdee579ea51685bafa.jpeg" alt="" width="16" height="16" /> punkrockgirl (Basque)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16536247/medium/f010c8e718a36229733a8b58f6bad2a4_default.png" alt="" width="16" height="16" /> radecos (French)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16538917/medium/092ec03f56f9dd1cbce94379fa4d4d38.png" alt="" width="16" height="16" /> Razem (Czech)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/14345134/medium/89a299239890c79a1d791d08ec3951dc.png" alt="" width="16" height="16" /> realpixelcode (German)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16527325/medium/37ebb27e7a50f7f85ae93beafc7028a2.jpg" alt="" width="16" height="16" /> rezahosseinzadeh (Persian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/13422319/medium/66632a98d73d48e36753d94ebcec9d4f.png" alt="" width="16" height="16" /> rwmpelstilzchen (Esperanto, Hebrew)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16538605/medium/bcdb6e3286b7d6237923f3a9383eed29.png" alt="" width="16" height="16" /> SadmL (Russian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16539171/medium/0ce95ef6b3b0566136191fbedc1563d0.png" alt="" width="16" height="16" /> SadmL_AI (Russian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/12381015/medium/35e3557fd61d85f9a5b84545d9e3feb4.png" alt="" width="16" height="16" /> shuuji3 (Japanese)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/14565190/medium/79100599131b7776e9803e4b696915a3_default.png" alt="" width="16" height="16" /> Sky_NiniKo (French)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/13143526/medium/2f15fa6d8e1703c7b82bb608b116a30a.png" alt="" width="16" height="16" /> Steffo99 (Italian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16532441/medium/1a47e8d80c95636e02d2260f6e233ca5.png" alt="" width="16" height="16" /> Su5hicz (Czech)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16530049/medium/683f3581620c6b4a5c753b416ed695a7.jpeg" alt="" width="16" height="16" /> tferrermo (Spanish)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15752199/medium/7e9efd828c4691368d063b19d19eb894.png" alt="" width="16" height="16" /> tkbremnes (Norwegian Bokmal)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16527851/medium/649e5a9a8a8cc61ced670d89e9cca082.png" alt="" width="16" height="16" /> tux93 (German)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/14427566/medium/ab733b5044c21867fc5a9d1b22cd2c03.png" alt="" width="16" height="16" /> Vac31. (Lithuanian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16026914/medium/e3ca187f354a298ef0c9d02a0ed17be7.jpg" alt="" width="16" height="16" /> valtlai (Finnish)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16608515/medium/85506c21dce8df07843ca11908ee3951.jpeg" alt="" width="16" height="16" /> vasiriri (Polish)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16563757/medium/af4556c13862d1fd593b51084a159b75_default.png" alt="" width="16" height="16" /> voyagercy (Chinese Traditional)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/15982109/medium/9c03062bdc1d3c6d384dbfead97c26ba.jpeg" alt="" width="16" height="16" /> xabi_itzultzaile (Basque)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16556017/medium/216e0f7a0c35b079920366939a3aaca7_default.png" alt="" width="16" height="16" /> xen4n (Ukrainian)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16532657/medium/f309f319266e1ff95f3070eab0c9a9d9_default.png" alt="" width="16" height="16" /> xqueralt (Catalan)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/14041603/medium/6ab77a0467b06aeb49927c6d9c409f89.jpg" alt="" width="16" height="16" /> ZiriSut (Kabyle)
- <img src="https://crowdin-static.downloads.crowdin.com/avatar/16530601/medium/e1b6d5c24953b6405405c1ab33c0fa46.jpeg" alt="" width="16" height="16" /> zkreml (Czech)
<!-- i18n volunteers end -->

## Backstory

I am one of the earliest users of Twitter. Twitter was launched on [15 July 2006](https://en.wikipedia.org/wiki/Twitter). I joined on December 2006 and my [first tweet](https://twitter.com/cheeaun/status/1298723) was posted on 18 December 2006.

I know how early Twitter looks like. It was fun.

Back then, I [made a Twitter clone](https://twitter.com/cheeaun/status/789031599) called "Twig" written in Python and Google App Engine. I almost made my own [Twitter desktop client](https://github.com/cheeaun/chidori) written in Appcelerator Titanium. I [gave one of my best talks about the Twitter client](https://www.slideshare.net/cheeaun/story-of-a-thousand-birds) in a mini-conference. I built this thing called "Twitter [Columns](https://twitter.com/columns)", a web app that shows your list of followings, your followings' followings, your followers, your followers' followers and so on. In 2009, I wrote a blog post titled ["How I got started with Twitter"](https://cheeaun.com/blog/2009/04/how-i-got-started-with-twitter/). I created [two](https://twitter.com/cheeaun/status/1273422454) [themes](https://twitter.com/cheeaun/status/1487781343) for DestroyTwitter (a desktop client made with Adobe Air by Jonnie Hallman) and one of them is called ["Vimeo"](https://dribbble.com/shots/31624). In 2013, I wrote [my own tweets backup site](https://github.com/cheeaun/tweets) with a front-end to view my tweets and a [CouchDB backend](https://github.com/cheeaun/tweet-couch) to store them.

It's been **more than 15 years**.

And here I am. Building a Mastodon web client.

## Alternative web clients

- Phanpy forks ↓
  - [Agora](https://agorasocial.app/)
- [Pinafore](https://pinafore.social/) ([retired](https://nolanlawson.com/2023/01/09/retiring-pinafore/)) - forks ↓
  - [Semaphore](https://semaphore.social/)
  - [Enafore](https://enafore.social/)
- [Cuckoo+](https://www.cuckoo.social/)
- [Sengi](https://nicolasconstant.github.io/sengi/)
- [Soapbox](https://fe.soapbox.pub/)
- [Elk](https://elk.zone/) - forks ↓
  - [elk.fedified.com](https://elk.fedified.com/)
- [Mastodeck](https://mastodeck.com/)
- [Trunks](https://trunks.social/)
- [Tooty](https://github.com/n1k0/tooty)
- [Litterbox](https://litterbox.koyu.space/)
- [Statuzer](https://statuzer.com/)
- [Tusked](https://tusked.app/)
- [Mastodon Glitch Edition (standalone frontend)](https://iceshrimp.dev/iceshrimp/masto-fe-standalone)
- [Mangane](https://github.com/BDX-town/Mangane)
- [TheDesk](https://github.com/cutls/TheDesk)
- [More...](https://github.com/hueyy/awesome-mastodon/#clients)

## 💁‍♂️ Notice to all other social media client developers

Please, please copy the UI ideas and experiments from this app. I think some of them are pretty good and it would be great if more apps have them.

If you're not a developer, please tell your favourite social media client developers about this app and ask them to copy the UI ideas and experiments.

## License

[MIT](https://cheeaun.mit-license.org/).
