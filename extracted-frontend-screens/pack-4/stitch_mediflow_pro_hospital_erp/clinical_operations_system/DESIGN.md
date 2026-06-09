---
name: Clinical Operations System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  layout-margin: 24px
  gutter: 16px
---

## Brand & Style
The design system is engineered for high-stakes healthcare environments where clarity, speed of cognition, and emotional stability are paramount. The brand personality is **composed and clinical yet human-centric**, blending the reliability of a high-end enterprise tool with the warmth of a modern care facility.

The aesthetic follows a **Modern Corporate** style with subtle **Tactile** influences. It prioritizes information density without sacrificing breathing room, ensuring that practitioners can scan complex patient data without cognitive fatigue. The UI uses soft transitions and a "warm-neutral" foundation to reduce the sterile, cold feeling often associated with medical software.

## Colors
The palette is rooted in **Surface Warm** tones (off-whites with a hint of cream) to reduce eye strain during long shifts. 

- **Primary & Text:** Slate 900 is used for high-contrast text and structural elements to ensure maximum legibility.
- **Semantic Logic:** We utilize a strict traffic-light system for patient safety. Emerald (Success) denotes stable vitals or completed tasks; Amber (Warning) indicates pending results; Red (Danger) is reserved for critical alerts and high-acuity triage.
- **Actionable Blue:** Blue 500 is the primary "interact" color, used for links, primary buttons, and active navigation states.

## Typography
This design system utilizes **Inter** for its exceptional legibility at small sizes and high x-height, which is critical for reading patient charts and medication dosages. 

The type scale is "tight," favoring smaller increments to support a **high-density data display**. 
- **Body-sm (13px)** is the workhorse for table data and form labels.
- **Label-md (12px uppercase)** is used for categorization and section headers within sidebars.
- **Display-lg** is reserved for dashboard-level metrics.
- On mobile, `display-lg` should scale down to `headline-md` (24px) to prevent layout breaking.

## Layout & Spacing
The layout uses a **12-column fluid grid** for desktop and a **single-column stack** for mobile. 

- **Sidebar:** Fixed at 280px for desktop, collapsible to 64px (icons only) to maximize workspace. On tablet/mobile, it transitions to a drawer.
- **Information Density:** Use an 8px baseline grid generally, but compress to 4px for interior component spacing (e.g., labels to inputs) to maintain a "tight" professional feel.
- **Safe Zones:** Always maintain a 24px outer margin on the main content area to prevent the UI from feeling claustrophobic on large monitors.

## Elevation & Depth
Depth is signaled through **Tonal Layering** rather than heavy shadows. This keeps the interface clean and "sanitary."

1.  **Canvas (Level 0):** Background (#f8fafc).
2.  **Surface (Level 1):** White cards with a 1px border (#e2e8f0). No shadow.
3.  **Raised (Level 2):** Modals and dropdowns. Uses a soft, diffused shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.05)`.
4.  **Overlay (Level 3):** Global search and critical alerts. High contrast with a subtle backdrop blur (8px) to keep context of the page behind.

Use **Low-contrast outlines** for secondary buttons and input fields to maintain a flat, professional profile.

## Shapes
We use **Soft (0.25rem)** roundedness. This provides enough softness to feel approachable and "warm" without appearing toy-like or wasting space.

- **Standard Elements:** 4px radius (Buttons, Inputs, Chips).
- **Containers/Cards:** 8px radius (Large surface areas).
- **Bed Grids:** 4px radius to maximize the clickable area within tight dashboard grids.

## Components

### App Shell
- **Sidebar:** Nested navigation with active states indicated by a 3px vertical "accent bar" in Blue 500 on the left edge.
- **Top Bar:** Features a breadcrumb trail in `body-sm` and a prominent "Tenant/Ward Selector" dropdown.

### Tables & Data
- **Density:** Rows should have a fixed height of 48px for standard, 40px for "Compact View."
- **Status Chips:** Small caps, semi-bold text. Use a light background (10% opacity) of the semantic color with a 100% opacity text for high readability (e.g., Light Emerald background with Dark Emerald text).

### Forms & Inputs
- **Validation:** Required fields are marked with a subtle red dot (not an asterisk) for a cleaner look.
- **Focus States:** 2px solid Blue 500 ring with a 2px offset.

### Specialized HMS Components
- **Bed Grids:** Squared cards representing ward beds. Color-coded top border (Success/Danger) based on occupancy or patient status. Use icons for "Needs Cleaning" or "Oxygen Required."
- **Queue Cards:** Compact draggable cards for triage. Must display: Patient Name, Triage Level (color block), and "Time in Queue."
- **Skeletons:** Use a subtle pulse animation on a `#f1f5f9` base.

### Feedback States
- **Empty States:** Use monochromatic, soft-line illustrations. Include a clear "Primary Action" button to populate data.
- **Destructive Modals:** Headers must be `text-danger`. Requires a mandatory "Reason for Action" text area to maintain medical audit trails.