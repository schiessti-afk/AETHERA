# AETHERA — Design System

**Product:** AETHERA  
**Tagline:** Live Airspace Intelligence  
**Document:** Design System  
**Version:** 0.1  
**Status:** Initial Design Definition  
**Last Updated:** 2026-08-26

---

## 1. Design Vision

AETHERA is a real-time airspace intelligence platform.

The visual identity must communicate:

> **Precision without complexity.**

The interface should feel like a sophisticated aerospace intelligence system while remaining intuitive enough for anyone to explore.

The design should combine:

- Premium dark UI
- High-performance visualization
- Aviation-inspired information density
- Minimal interface chrome
- Strong typography
- Subtle motion
- Clear hierarchy
- Exceptional map presentation

AETHERA should feel professional, cinematic, technical, and calm.

It should **not** feel like:

- A generic SaaS dashboard
- A gaming interface
- A cryptocurrency dashboard
- A traditional aviation control panel
- A copy of Flightradar24
- A collection of glassmorphism cards

---

## 2. Core Design Principles

### 2.1 Map First

The airspace visualization is the product.

UI elements should never unnecessarily cover the map.

The interface should provide context around the map rather than compete with it.

### 2.2 Information Density With Restraint

AETHERA contains large amounts of information.

The solution is not to remove information.

The solution is to establish a strong hierarchy.

For example:

**LH123**

36,250 FT  
482 KT  
274°

is more important visually than:

ICAO24: 3C65AA  
Last contact: 4 seconds ago  
Squawk: 2143

Primary information should be immediately readable.

Secondary information should become visible when needed.

### 2.3 Progressive Disclosure

Do not expose every piece of information simultaneously.

The interaction hierarchy should be:

```
Map
  ↓
Aircraft
  ↓
Hover
  ↓
Telemetry
  ↓
Select
  ↓
Detailed information
  ↓
Advanced information
```

### 2.4 Calm Technology

The interface should not constantly demand attention.

Animations and alerts should have meaning.

Avoid:

- Constant flashing
- Excessive glowing
- Pulsing everything
- Animated backgrounds
- Excessive notification sounds
- Aggressive transitions

AETHERA should feel alive without feeling chaotic.

---

## 3. Brand Personality

AETHERA should feel:

| Attribute     | Target   |
| ------------- | -------- |
| Technical     | Very high |
| Premium       | Very high |
| Minimal       | High     |
| Futuristic    | Moderate |
| Aviation      | High     |
| Serious       | High     |
| Playful       | Low      |
| Cinematic     | Moderate |
| Experimental  | Moderate |

The design should feel closer to a modern aerospace visualization laboratory than a consumer travel application.

---

## 4. Visual Language

The visual language consists of five major elements:

```
DARK SURFACE
     +
PRECISION TYPOGRAPHY
     +
LIVE DATA
     +
GEOSPATIAL VISUALIZATION
     +
SUBTLE MOTION
```

The combination should immediately identify AETHERA.

---

## 5. Color System

The application should use a dark-first color system.

Do not build the interface around dozens of colors.

Most of the UI should be neutral.

### 5.1 Backgrounds

Recommended conceptual hierarchy:

- Background
- Surface
- Surface Elevated
- Surface Interactive
- Surface Selected

Example token structure:

```css
--color-background
--color-surface
--color-surface-elevated
--color-surface-interactive
--color-surface-selected
```

The exact values should be refined during implementation.

### 5.2 Neutral Palette

The neutral palette should range from almost-black to light gray.

Example conceptual scale:

- Neutral 950
- Neutral 900
- Neutral 850
- Neutral 800
- Neutral 700
- Neutral 600
- Neutral 500
- Neutral 400
- Neutral 300
- Neutral 200
- Neutral 100
- Neutral 50

Use darker values for:

- Main background
- Map UI
- Panels

Use lighter values for:

- Primary text
- Secondary text
- Borders
- Disabled states

---

## 6. Accent Color

AETHERA should use one primary accent color.

The accent should feel:

- Digital
- Atmospheric
- Technical
- Modern
- Clearly visible on dark surfaces

A cyan/blue-green direction is recommended.

Conceptually:

```
Primary Accent
     ↓
Interactive elements
     ↓
Selected aircraft
     ↓
Live indicator
     ↓
Important telemetry
```

The accent should not flood the interface.

Use it strategically.

---

## 7. Semantic Colors

Semantic colors are reserved for system states.

### Success

Used for:

- Healthy connection
- Successful operations
- Positive system state

### Warning

Used for:

- Unusual conditions
- Degraded data
- Stale telemetry

### Alert

Used for:

- Important detected events
- Emergency squawk observations
- Critical application conditions

### Danger

Reserved for genuinely severe UI states.

Do not use alert colors simply because something is visually interesting.

---

## 8. Alert Color Hierarchy

Example:

| Level    | Treatment              |
| -------- | ---------------------- |
| INFO     | Neutral / subtle accent |
| UNUSUAL  | Warning                |
| ALERT    | Strong alert color     |
| CRITICAL | Danger                 |

The UI must distinguish between an observed event and an actual aviation emergency.

For example:

**7700 OBSERVED**

rather than:

**PLANE IN EMERGENCY**

unless verified by an authoritative source.

---

## 9. Typography

Typography is one of the most important parts of AETHERA.

### Primary Typeface

**Recommended:** Inter

**Alternative:**

- Geist
- IBM Plex Sans
- Manrope

The final choice should prioritize:

- Excellent numeric rendering
- Clear small text
- Strong weights
- Good browser rendering
- Wide language support

---

## 10. Typography Hierarchy

Use a limited number of text styles.

### Display

For major application metrics.

**12,482**

### Heading

For:

- Page titles
- Panel titles

### Subheading

For:

- Section titles

### Body

For normal information.

### Label

For telemetry labels.

### Micro

For:

- Timestamps
- Metadata
- Data source information

---

## 11. Telemetry Typography

Telemetry should have a distinct visual hierarchy.

Example:

**ALTITUDE**

36,250 FT

The value should be significantly more prominent than the label.

Preferred structure:

```
36,250
FT
```

rather than:

```
Altitude: 36,250 feet
```

This makes scanning much faster.

---

## 12. Numeric Font Features

Where supported, telemetry numbers should use:

```css
font-variant-numeric: tabular-nums;
```

This ensures numbers align correctly when values change.

For example:

```
36,250
36,275
36,300
36,325
```

should not visually jump because of changing glyph widths.

---

## 13. Spacing System

Use a consistent spacing scale.

Recommended base unit:

**4px**

Example:

```
4
8
12
16
20
24
32
40
48
64
80
96
```

Avoid arbitrary spacing values unless necessary.

---

## 14. Layout Grid

Desktop layouts should use a flexible grid.

The map should always receive the majority of available screen space.

Example:

```
┌──────────────────────────────────────────────┐
│ Header                                       │
├───────┬──────────────────────────────┬───────┤
│       │                              │       │
│ Nav   │            MAP               │ Info  │
│       │                              │       │
│       │                              │       │
└───────┴──────────────────────────────┴───────┘
```

Panels should never force the map into an unnecessarily small viewport.

---

## 15. Navigation

The main navigation should be minimal.

Possible structure:

- AETHERA
- Explore
- Alerts
- Airports
- Analytics
- History

The active section should be immediately recognizable.

Avoid large navigation bars.

---

## 16. Header

The global header should remain compact.

Example:

```
AETHERA                         LIVE ●
Live Airspace Intelligence
```

Additional controls may include:

- Search
- Layers
- 2D / 3D
- Settings

The header should not consume significant vertical space.

---

## 17. Live Indicator

The live indicator is an important brand element.

Example:

**● LIVE**

It should communicate:

- Data connection exists
- Updates are actively arriving

Possible states:

| Indicator       | State      |
| --------------- | ---------- |
| ● LIVE          | Connected  |
| ◌ CONNECTING    | Connecting |
| △ DEGRADED      | Degraded   |
| ○ OFFLINE       | Offline    |

The indicator should not constantly pulse.

A subtle animation may be used when transitioning between states.

---

## 18. Panels

Panels should feel integrated into the map.

Avoid traditional large dashboard cards.

Preferred:

```
┌─────────────────────┐
│ AIRCRAFT            │
│                     │
│ LH123               │
│ Lufthansa           │
│                     │
│ 36,250 FT           │
│ 482 KT              │
└─────────────────────┘
```

Panels should use:

- Dark surfaces
- Subtle borders
- Small corner radius
- Controlled shadows
- Strong internal spacing

---

## 19. Border Radius

AETHERA should use restrained rounding.

Recommended:

| Token   | Value |
| ------- | ----- |
| Small   | 4px   |
| Default | 6px   |
| Large   | 8px   |

Avoid:

- 16px
- 20px
- 24px
- 32px

for normal UI components.

The interface should feel precise rather than playful.

---

## 20. Borders

Borders should be subtle.

Use borders primarily to establish hierarchy between surfaces.

Example:

```css
border: 1px solid var(--color-border);
```

Avoid thick borders.

Borders should rarely become the dominant visual element.

---

## 21. Shadows

Shadows should be subtle and functional.

Use shadows to separate floating UI from the map.

Do not use large decorative shadows.

Example conceptual hierarchy:

```
Map
  ↓
Floating panel
  ↓
Modal
```

Each elevation level should have slightly stronger separation.

---

## 22. Glass Effects

Glassmorphism should be used sparingly.

AETHERA may use subtle transparency for floating controls, but:

- Do not blur everything.
- Do not make every card transparent.
- Do not rely on glass effects for hierarchy.

The map must remain readable underneath UI.

---

## 23. Aircraft Visualization

Aircraft are the most important visual objects on the map.

They should be immediately identifiable.

Each aircraft marker should communicate:

- Position
- Direction
- Selection state
- Potential alert state

---

## 24. Aircraft Marker States

Aircraft markers should have states:

- DEFAULT
- HOVER
- SELECTED
- FOLLOWED
- ALERT
- STALE

Example:

```
       ✈
       ↑
```

The icon should rotate according to aircraft heading when heading is available.

---

## 25. Aircraft Selection

Selected aircraft should become visually prominent without becoming enormous.

Selection can use:

- Accent outline
- Subtle glow
- Enlarged marker
- Short highlight animation

Avoid permanent large glowing markers.

---

## 26. Aircraft Trails

Trails should visually communicate movement.

Recommended visual behavior:

```
Older ─────────────── Newer
 faint                 strong
```

Trail opacity should decrease with age.

The trail should never obscure other aircraft.

---

## 27. Altitude Visualization

Altitude can be communicated through:

- Actual 3D height
- Numeric altitude
- Subtle visual encoding
- Optional altitude layer

Do not make color the sole altitude indicator.

---

## 29. Map Styling

The map should use a dark, low-noise cartographic style.

Prioritize:

- Coastlines
- Countries
- Major cities
- Airports
- Geographic orientation

Reduce:

- Minor roads
- POIs
- Commercial labels
- Visual clutter

The aircraft should remain the visual focus.

---

## 30. Map Controls

Controls should look like part of the application.

Example:

```
┌────┐
│ +  │
├────┤
│ −  │
└────┘

┌────────┐
│ 2D 3D  │
└────────┘
```

Controls should:

- Have clear hit areas
- Support keyboard interaction
- Have tooltips
- Use consistent spacing

---

## 31. Search

Search should be one of the most polished interactions.

Recommended:

**⌘ K**

or:

**Ctrl K**

opens a command/search interface.

Search should support:

- Aircraft
- Airports
- Callsigns
- ICAO24

The search experience should feel instant.

---

## 32. Command Palette

The command palette can eventually become a central navigation mechanism.

Example:

```
┌────────────────────────────────────────────┐
│ Search aircraft, airport or command...     │
├────────────────────────────────────────────┤
│                                            │
│ LH123                                      │
│ Lufthansa                                  │
│                                            │
│ Frankfurt Airport                          │
│                                            │
│ Go to Europe                               │
│                                            │
│ Toggle 3D                                  │
│                                            │
└────────────────────────────────────────────┘
```

Keyboard navigation should be supported.

---

## 33. Aircraft Detail Panel

The detail panel should prioritize telemetry.

Recommended hierarchy:

```
CALLSIGN
AIRLINE / AIRCRAFT

STATUS

ALTITUDE
36,250 FT

SPEED
482 KT

HEADING
274°

VERTICAL RATE
-850 FPM

──────────────

ICAO24
3C65AA

SQUAWK
2143

LAST CONTACT
4 SEC AGO

[ FOLLOW ]
[ TRAIL ]
```

---

## 34. Panel Information Architecture

Information should be grouped into:

### Identity

- Callsign
- Aircraft identifier
- Airline
- Aircraft type when available

### Position

- Latitude
- Longitude
- Altitude
- Heading

### Movement

- Speed
- Vertical rate
- Ground state

### Transponder

- ICAO24
- Squawk

### Data

- Last contact
- Data source
- Observation timestamp

---

## 35. Alerts Panel

The alerts panel should be chronological.

Example:

```
ALERTS

● 7700 OBSERVED
  Aircraft 3C65AA
  32 sec ago

△ RAPID DESCENT
  Aircraft 4CA123
  1 min ago

● DATA STALE
  Aircraft A1B2C3
  2 min ago
```

The user should be able to click an alert and immediately focus the corresponding aircraft.

---

## 36. Alert Animation

New alerts can enter the feed with a subtle transition.

Avoid:

```
FLASH
FLASH
FLASH
```

Prefer:

**fade + slide**

The alert should remain visually noticeable without becoming disruptive.

---

## 37. Statistics Bar

The live statistics bar should be compact.

Example:

```
12,482 OBSERVED
8,932 AIRBORNE
1,842 CLIMBING
1,327 DESCENDING
7 ALERTS
```

Numbers should update smoothly.

Avoid animated number counters that constantly distract users.

---

## 38. Charts

Charts should follow the AETHERA visual language.

Requirements:

- Minimal grid lines
- Clear labels
- Strong numeric hierarchy
- Limited colors
- Responsive
- Tooltips for details

Charts should emphasize patterns rather than decoration.

---

## 39. Buttons

Buttons should have clear hierarchy.

### Primary

Used for major actions:

**FOLLOW AIRCRAFT**

### Secondary

Used for supporting actions:

**SHOW TRAIL**

### Tertiary

Used for low-priority actions.

### Icon Button

Used for:

- Map controls
- Close
- Settings
- Layers

Every icon-only button must have an accessible label.

---

## 40. Button Behavior

Buttons should have:

- Default
- Hover
- Active
- Focus
- Disabled
- Loading

Transitions should be fast and subtle.

---

## 41. Tooltips

Tooltips should explain unfamiliar controls.

Example:

**3D VIEW**

Tooltips should not explain obvious controls such as a clearly labeled "Close" button.

Tooltips should never contain essential information that is unavailable elsewhere.

---

## 42. Loading States

Loading states should preserve the layout.

Avoid replacing the entire page with:

**Loading...**

Instead use:

- Skeleton panels
- Subtle loading indicators
- Map loading state
- Connection state

The application should feel alive while data loads.

---

## 43. Skeleton Design

Skeletons should match the final component shape.

Example:

```
┌─────────────────────┐
│ ███████████         │
│                     │
│ ███████             │
│ ████████████        │
│                     │
│ █████               │
└─────────────────────┘
```

Skeleton animation should be subtle.

---

## 44. Empty States

Empty states should be informative.

Example:

```
NO ACTIVE ALERTS

No detected conditions currently
match your alert rules.
```

Do not use unnecessary illustrations.

---

## 45. Error States

Error messages should explain:

- What happened.
- Whether the system is recovering.
- What the user can do.

Example:

```
LIVE DATA UNAVAILABLE

We're attempting to reconnect to the
airspace data service.

[ RETRY ]
```

---

## 46. Data Freshness

Freshness should be visually represented.

Example:

```
LIVE
Updated 3 sec ago
```

If stale:

```
STALE
Last update 48 sec ago
```

If disconnected:

```
OFFLINE
Last update 2 min ago
```

The UI should never imply that stale information is live.

---

## 47. Motion System

Motion should follow a consistent timing system.

Recommended:

| Speed   | Duration  |
| ------- | --------- |
| Fast    | 100–150ms |
| Default | 150–250ms |
| Slow    | 250–400ms |

Aircraft interpolation is a separate continuous motion system.

---

## 48. Easing

Use smooth easing for interface transitions.

Preferred conceptual behavior:

**ease-out** for entering elements.

**ease-in-out** for state changes.

Avoid exaggerated spring animations throughout the interface.

---

## 49. Aircraft Movement

Aircraft should not jump from one observation position to another.

The frontend should interpolate between observations.

Example:

```
Observation A
      ↓
Interpolation
      ↓
Observation B
```

The displayed movement should feel continuous at 60 FPS where practical.

The UI must still preserve the distinction between:

- Observed position
- Interpolated display position

---

## 50. 3D Motion

Camera movement should be smooth.

When switching to 3D:

```
2D
 ↓
camera transition
 ↓
3D
```

Avoid sudden perspective changes.

Follow mode should use a stable camera.

---

## 51. Responsive Design

Desktop is the primary design target.

Recommended breakpoints should be based on layout requirements rather than specific device names.

Conceptually:

- Mobile
- Tablet
- Desktop
- Large Desktop

---

## 52. Mobile Navigation

On mobile, use a compact bottom navigation or equivalent navigation pattern.

Example:

```
┌─────────────────────────────┐
│                             │
│            MAP              │
│                             │
│                             │
├─────────────────────────────┤
│ Explore Alerts Airports More│
└─────────────────────────────┘
```

The map must retain maximum possible screen area.

---

## 53. Mobile Aircraft Details

Aircraft details should become a bottom sheet.

Example:

```
──────────────────────────────
LH123

36,250 FT
482 KT
274°

Lufthansa

[ FOLLOW ]
[ TRAIL ]
──────────────────────────────
```

The user should still be able to see the aircraft on the map.

---

## 54. Accessibility

Accessibility is part of the design system.

Requirements:

- WCAG-conscious contrast
- Keyboard navigation
- Focus states
- Screen-reader labels
- Accessible dialogs
- Accessible forms
- Reduced-motion support
- Semantic HTML

Critical information must not rely exclusively on color.

---

## 55. Reduced Motion

When reduced motion is enabled:

- Disable unnecessary panel animation.
- Reduce aircraft visual interpolation where appropriate.
- Remove decorative pulsing.
- Simplify camera transitions.
- Preserve functional state changes.

The map must remain usable.

---

## 56. Iconography

Icons should be:

- Simple
- Geometric
- Consistent
- Thin/medium weight
- Familiar

Recommended icon library:

**Lucide**

Avoid mixing multiple icon styles.

---

## 57. Aircraft Icons

Aircraft-specific icons may use a dedicated aviation icon set or custom SVG assets.

They should remain:

- Minimal
- Directional
- Recognizable at small sizes

Do not use overly detailed airplane illustrations.

---

## 58. Data Visualization Rules

Every visualization must answer a question.

Examples:

> Where is traffic concentrated?

→ Airport-area traffic breakdown.

> What altitude is traffic using?

→ Altitude distribution.

> What is happening right now?

→ Live statistics.

Avoid charts that exist only because a dashboard "needs charts."

---

## 59. Tables

Tables should be used for detailed datasets rather than the primary live map experience.

Example:

| CALLSIGN | ALT    | SPEED | HDG  | STATUS |
| -------- | ------ | ----- | ---- | ------ |
| LH123    | 36,250 | 482   | 274° | LIVE   |
| OS456    | 31,400 | 451   | 188° | LIVE   |
| BA921    | 29,800 | 438   | 092° | STALE  |

Use tabular numeric alignment.

---

## 60. Data Density Modes

Future versions may provide:

- Comfort
- Standard
- Dense

This could allow advanced users to display more telemetry without changing the fundamental application.

---

## 61. Dark Mode

AETHERA is designed primarily as a dark application.

A light theme is not a priority for MVP.

If a light theme is introduced later, it should be treated as a complete visual theme rather than simply inverting colors.

---

## 62. Microcopy

AETHERA's language should be concise.

Prefer:

- LIVE
- OBSERVED
- TRACKING
- STALE
- DEGRADED

instead of:

> The aircraft is currently being tracked by our system.

Use technical language where appropriate, but avoid unnecessary jargon.

---

## 63. Voice

The product voice should be:

- Neutral
- Precise
- Confident
- Informative
- Concise

Avoid:

- Marketing hype inside the application
- Excessive exclamation marks
- Casual language
- Sensational language around anomalies

Especially avoid turning observed emergency squawks into sensational headlines.

---

## 64. Notifications

Notifications should be useful and contextual.

Example:

```
7700 OBSERVED

3C65AA · 18,400 FT
Observed 12 sec ago
```

Avoid:

```
🚨 EMERGENCY!!! 🚨
```

The product should remain professional.

---

## 65. Map Interaction Principles

The map should support:

- Click
- Hover
- Drag
- Zoom
- Scroll
- Touch
- Keyboard-accessible controls

Interaction should remain predictable.

A selected aircraft should remain selected until:

- The user selects another aircraft.
- The user closes the panel.
- The aircraft disappears for a configured period.

---

## 66. Hover Behavior

Hover should provide a compact preview.

Example:

```
LH123
36,250 FT · 482 KT
```

Do not open the complete aircraft panel on hover.

Hover is for discovery.

Click is for commitment.

---

## 67. Selected State

Selected aircraft should have:

- Strong visual emphasis
- Detail panel
- Optional trail
- Optional follow mode

The selected state should remain obvious even in dense airspace.

---

## 68. Follow Mode

Follow mode should create a focused experience.

Example:

```
FOLLOWING

LH123

36,250 FT
482 KT
274°

[ EXIT FOLLOW ]
```

The user should never become trapped in follow mode.

---

## 69. 2D / 3D Toggle

The 2D/3D control should be highly discoverable.

Example:

```
[ 2D ] [ 3D ]
```

Switching modes should preserve:

- Geographic location
- Selected aircraft
- Active filters
- Relevant layers

---

## 70. Filters

Filters should be accessible without overwhelming the interface.

Potential filters:

- Altitude
- Speed
- Aircraft type
- Airline
- Squawk
- Vertical rate
- Region

MVP should keep filters limited.

---

## 71. Filter Design

Use a filter drawer/popover rather than permanently displaying all controls.

Example:

```
FILTERS

Altitude
[ 0 ───────── 45,000 FT ]

Status
☑ Airborne
☐ Ground

Alerts
☐ 7500
☐ 7600
☐ 7700
```

---

## 72. Design Tokens

The UI implementation should centralize visual decisions.

Example token structure:

```
tokens/
├── colors
├── typography
├── spacing
├── radius
├── shadows
├── motion
└── z-index
```

Components should consume tokens rather than hard-code arbitrary values.

---

## 73. Z-Index Hierarchy

The application should maintain a predictable layer hierarchy.

Conceptually:

```
Map
↓
Map labels
↓
Aircraft
↓
Map controls
↓
Floating panels
↓
Dropdowns
↓
Dialogs
↓
Critical notifications
```

Avoid arbitrary z-index values throughout the application.

---

## 74. Component Architecture

Reusable UI components should include:

- Button
- IconButton
- Badge
- Tooltip
- Popover
- Dialog
- Panel
- Drawer
- BottomSheet
- Tabs
- Search
- CommandPalette
- Statistic
- Telemetry
- Alert
- AircraftCard
- AircraftPanel
- LayerControl
- MapControl
- StatusIndicator
- DataTable
- Chart

Components should remain composable.

---

## 75. Component Philosophy

Components should be:

- Small
- Reusable
- Accessible
- Predictable
- Theme-aware

Avoid components containing unrelated application logic.

The visual system should be separated from the airspace domain logic.

---

## 76. Design System Rule

When a new component is needed, first ask:

> Can this be represented using an existing AETHERA pattern?

Only introduce a new visual pattern when necessary.

This prevents the UI from becoming inconsistent as the application grows.

---

## 77. Performance and Design

Visual quality must never come at the expense of performance.

Avoid:

- Excessive DOM elements over the map
- Hundreds of animated HTML elements
- Large blur effects everywhere
- Constant React-driven animations
- Unnecessary shadows
- Heavy decorative assets

Large-scale aircraft rendering should be handled by the map/WebGL layer rather than ordinary DOM elements where appropriate.

---

## 78. Desktop Experience

The ideal desktop experience should feel like a command center without looking like one.

Example:

```
┌──────────────────────────────────────────────────────────────┐
│ AETHERA                         SEARCH      LIVE ●            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│                         AIRSPACE                              │
│                                                              │
│              ✈          ✈                    ✈               │
│                                                              │
│       ✈                         ✈                            │
│                                                              │
│                         ✈                                    │
│                                                              │
│                                                              │
│                                    ┌──────────────────────┐   │
│                                    │ LH123                │   │
│                                    │ 36,250 FT            │   │
│                                    │ 482 KT               │   │
│                                    │ 274°                 │   │
│                                    └──────────────────────┘   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ 12,482 OBSERVED   8,932 AIRBORNE   1,842 CLIMBING   7 ALERTS │
└──────────────────────────────────────────────────────────────┘
```

---

## 79. Visual Hierarchy

At any moment the user should be able to identify:

### Level 1

What is happening in the airspace?

### Level 2

Where are the aircraft?

### Level 3

Which aircraft am I looking at?

### Level 4

What is its telemetry?

### Level 5

Is anything unusual happening?

The UI should preserve this hierarchy.

---

## 80. Design Anti-Patterns

Do not introduce:

### Dashboard Card Explosion

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ 123 │ │ 456 │ │ 789 │ │ 321 │
└─────┘ └─────┘ └─────┘ └─────┘
```

unless those cards provide meaningful value.

### Excessive Glass

Every component should not look transparent.

### Excessive Neon

AETHERA is not a cyberpunk game.

### Excessive Animation

Motion should communicate state.

### Excessive Color

Color should communicate meaning.

### Excessive Text

The map and telemetry should carry the experience.

---

## 81. Premium Quality Checklist

Before considering a UI screen complete, verify:

- Is the hierarchy obvious?
- Is the map the dominant visual?
- Are important numbers easy to scan?
- Are controls discoverable?
- Is there unnecessary visual noise?
- Are borders subtle?
- Are animations meaningful?
- Are empty states polished?
- Are error states polished?
- Does the screen feel like AETHERA?
- Does it work at different screen sizes?
- Does it remain performant with real data?

---

## 82. Design North Star

Every design decision should be evaluated against:

> Does this make AETHERA better at helping the user understand live airspace?

If yes, keep it.

If it only makes the interface more decorative, reconsider it.

---

## 83. Final Design Statement

AETHERA should look like a product that could exist at the intersection of:

**Aerospace × Data Visualization × Real-Time Intelligence × Premium Software**

The final experience should be:

> Dark. Precise. Fluid. Intelligent. Beautiful.

The map should feel alive.

The aircraft should feel physical.

The data should feel trustworthy.

The interface should disappear when it is not needed.

And when the user selects an aircraft, the system should reveal the complexity underneath without overwhelming them.

**AETHERA — Live Airspace Intelligence.**

See the sky differently.
