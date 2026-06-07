# Noxubee Lodge Photography Workshop

A single-page event website for the **Noxubee Lodge Photography Workshop** — August 28–30, 2026 at Sumter Farm, Alabama. Led by photographer Betty Press.

Built as static HTML/CSS/JS for deployment on [GitHub Pages](https://pages.github.com/).

## Preview Locally

Open `index.html` in a browser, or run a local static server:

```bash
npx serve .
```

Then visit `http://localhost:3000`.

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `BettyWorkshop`).
2. Push this folder to the `main` branch:

   ```bash
   git init
   git add .
   git commit -m "Add Noxubee Lodge Photography Workshop event site"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/BettyWorkshop.git
   git push -u origin main
   ```

3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Choose branch `main` and folder `/ (root)`.
6. Save. The site will be live at:

   ```
   https://YOUR_USERNAME.github.io/BettyWorkshop/
   ```

The `.nojekyll` file ensures GitHub Pages serves all files without Jekyll processing.

## Project Structure

```
├── index.html       # Single-page site
├── css/styles.css   # Styles (earthy palette, grain overlay, responsive layout)
├── js/main.js       # Preloader, scroll reveals, mobile nav, smooth anchors
├── img/
│   ├── grain.png    # Seamless noise texture overlay
│   └── hero.jpg     # Hero / experience image (placeholder)
└── .nojekyll        # GitHub Pages config
```

## Design

- **Colors:** `#a49070` (warm oat) and `#2a2622` (deep earth)
- **Typography:** Cormorant Garamond (display) + Source Sans 3 (body) via Google Fonts
- **Inspiration:** Editorial layout patterns from [Son Daven](https://sondaven.com/en) — grain overlay, dividers, scroll reveals, slow reflective pacing

## Imagery

The hero image is a placeholder from [Unsplash](https://unsplash.com/photos/golden-wheat-field-during-sunset-1500382017468) (golden field at sunset). Replace `img/hero.jpg` with lodge or prairie photography from Noxubee Lodge when available.

## Registration

This is a static site. Registration is handled via email:

- **Hazel Bell** — [noxubeenews@gmail.com](mailto:noxubeenews@gmail.com)
- **Facebook** — [Noxubee Lodge on Facebook](https://www.facebook.com/NoxubeeLodge/)

## License

Content © Noxubee Lodge at Sumter Farm. Site code is provided for event promotion use.
