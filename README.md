# Eesha's portfolio

A local-first, original portfolio built with TypeScript, Vite, Three.js, and CSS.
No external models, hosted fonts, analytics, API keys, or backend are needed.

## Run

Requires Node.js 22.12 or newer, or Node.js 20.19 or newer.

```powershell
Set-Location C:\repos\portfolio
npm ci
npm run dev
```

The development site runs at `http://127.0.0.1:5173`.

```powershell
npm run build
npm run preview
```

The production preview runs at `http://127.0.0.1:4177`. The `dist` folder is
the static deployment artifact. Nothing is automatically published.

## Edit

- `src\content.ts`: project stories, experience, skills, and profile data.
- `index.html`: introduction, about copy, navigation, and contact details.
- `src\style.css`: typography, colors, layout, and responsive behavior.
- `src\machine.ts`: the fixed-front, on-demand 3D terminal and projected TV-style controls.
- `src\portrait.ts`: the monochrome dot surface and concealed photographic cutout.
- `public\images`: original concept illustrations, not actual product screenshots.
- `public\Eesha_Resume_2026.pdf`: preserved copy of the supplied resume.
- `artifacts\resume-content.txt`: extracted resume content, including embedded links.

Your original Downloads file is not needed. The PDF is intentionally available
through the website's resume download links; review its contact details before
publishing. The IBM internship dates are preserved exactly as supplied
(January-June 2026), including their overlap with the Microsoft full-time role.
No dates or metrics have been silently corrected.

## Interactions

The two arrows on the terminal's right bezel switch between all five projects.
Select the screen to open the current case study. A warm discovery bubble pops
up beside the controls, gives a gentle nudge, and disappears after an interaction
or seven visible seconds. Channel changes include a brief, screen-only TV-static
flicker; motion-off switches instantly without static or a bouncing hint. The finished 3D computer
and its controls appear together once the project artwork is ready; the flat
illustration is reserved for unavailable or interrupted graphics, not initial loading.
Styles load directly from the document head to avoid a partially styled first paint.

The horizontal ticker uses two identical, five-phrase groups for a seamless
loop with four to five phrases visible on desktop. Project case studies have a
dark editorial cover, full concept artwork, an emphasized takeaway, and numbered
build notes. Microsoft career symbols use their four-color treatment.

Motion starts on, as requested. The fixed pause button saves an explicit off
choice locally and restores it on the next visit. The computer itself only
renders when its content or size changes. Its 220-millisecond static transition
uses a lightweight layer on the projected screen, without repeatedly redrawing
the 3D model; the portrait suspends animation
offscreen and in background tabs.

The portrait uses the selected `65fe95` photograph. Initially only warm,
single-color dots are visible. Brushing or touching gently moves individual dots
and brings out their sampled photo colors, without a circular photo window.
The reveal uses a three-times finer grid in each direction for nine times the
available detail, while the resting surface keeps its wider dot spacing.
Finer dots gently spread from the original dot positions as color builds.
The brush follows the pointer with eased motion and a gradual rise and fade,
rather than switching instantly to a sharply defined reveal.
Individual dots remember the brushed path instead of following a rigid diamond
or circular mask. Their staggered, feathered response leaves a soft trail that
grows with pointer speed. Each touched dot holds its color for half a second,
then fades over 180 milliseconds; a stationary cursor never refreshes the trail.
Round, pixel-softened points stay smooth as they drift and return. Touch uses the
same movement-sensitive response. Idle frames draw only the original surface.
During interaction, only active detail points are drawn, and only changed
attribute ranges are uploaded, keeping the denser reveal responsive.
The portrait and signature stay upright. **Scatter the dots** reveals the
cutout; **Bring back the dots** covers it again. Those keyboard-accessible
controls also work with motion off, switching instantly instead of animating.
Loading and unavailable graphics use a dots-only fallback, never a plain-photo
flash.

## Quality checks

```powershell
npm run check
npm run build
npm test
```

Browser checks use the installed Google Chrome browser. They cover desktop and
mobile layouts, project filtering, terminal channels, keyboard navigation,
dialogs, the saved motion preference, WebGL fallback, the layered portrait, clipboard failures,
resume downloads, and automated accessibility checks. Rendering checks also cover
graphics recovery, on-demand rendering, paused/offscreen suspension, and frame
pacing during a full-page scroll. Screenshots, performance measurements, and the
report are written under `artifacts`.

## Design and privacy

The two supplied references informed the motion, editorial rhythm, and tactile
playfulness. Their source code, proprietary fonts, photographs, and models are
not used. Artwork and the terminal model were created for this portfolio.
Manrope and DM Mono are bundled locally through their open-source Fontsource
packages; their license files are included in `public\licenses`.

Photo processing is local. The selected source is preserved in
`artifacts\eesha-portrait-selected-65fe95.png`; the transparent photo and
monochrome fallback are in `public\images`. Background removal does not send
the image to an external service. Public image derivatives have their metadata
removed. The original sources and extracted resume under `artifacts` are not
included in the production `dist` directory.

To regenerate the portrait assets, restore the optional local Python tools and
run the preserved processing script:

```powershell
python -m pip install --target .\artifacts\image-tools opencv-python-headless Pillow
python .\artifacts\prepare-portrait.py
```

These tools are only needed for image preparation, not for running the site.

The site makes no third-party requests on load. Contact buttons open an email
client or the profile links from the resume. There is no pretend contact form
or invented project demo. All project details work without WebGL.
