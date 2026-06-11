---
name: Clinical Clarity
colors:
  surface: '#f9f9ff'
  surface-dim: '#cadaff'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e8edff'
  surface-container-high: '#e0e8ff'
  surface-container-highest: '#d7e2ff'
  on-surface: '#041b3c'
  on-surface-variant: '#434654'
  inverse-surface: '#1d3052'
  inverse-on-surface: '#edf0ff'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#526069'
  on-secondary: '#ffffff'
  secondary-container: '#d3e2ed'
  on-secondary-container: '#56656e'
  tertiary: '#004e32'
  on-tertiary: '#ffffff'
  tertiary-container: '#006844'
  on-tertiary-container: '#72e9af'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#d6e5ef'
  secondary-fixed-dim: '#bac9d3'
  on-secondary-fixed: '#0f1d25'
  on-secondary-fixed-variant: '#3b4951'
  tertiary-fixed: '#82f9be'
  tertiary-fixed-dim: '#65dca4'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005235'
  background: '#f9f9ff'
  on-background: '#041b3c'
  surface-variant: '#d7e2ff'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1200px
---

## Brand & Style
The design system is engineered to evoke deep trust, efficiency, and professional care. It adopts a **Modern Corporate** aesthetic with a strong emphasis on **Minimalism** to reduce cognitive load for patients navigating health information. 

The visual narrative focuses on "Calm Confidence"—utilizing generous whitespace, a systematic grid, and a refined color application that feels both clinical and compassionate. Every interaction should feel intentional and stable, avoiding unnecessary decorative elements in favor of functional clarity. The target audience spans from young tech-savvy users to elderly patients, requiring a high degree of accessibility and intuitive navigation.

## Colors
This design system utilizes a structured palette designed for high legibility and clear status communication. 

- **Primary Blue** is the anchor for all primary actions and brand presence, signifying medical authority.
- **Backgrounds** utilize a subtle off-white and light blue to reduce eye strain compared to pure white, creating a "clean room" feel.
- **Semantic Colors** follow industry standards but are calibrated for accessibility; the Amber and Green are balanced to remain distinct for color-blind users while maintaining a soft, non-alarming tone.
- **Typography** uses two tiers of slate to ensure a clear hierarchy between content headings and supporting information.

## Typography
The system relies exclusively on **Inter** for its exceptional legibility and systematic weight distribution. 

Headlines use semi-bold and bold weights with slightly tightened letter-spacing to appear more cohesive and authoritative. Body copy is set with generous line heights to facilitate easy reading of medical instructions and reports. The `label-md` role is specifically designed for table headers and small metadata, utilizing a slight uppercase transform and tracking to distinguish it from interactive body text.

## Layout & Spacing
The layout philosophy follows a strict **8px grid system** (with 4px increments for micro-adjustments). 

- **Desktop:** A 12-column fixed grid with a 1200px max-width, centered in the viewport.
- **Tablet:** A 6-column fluid grid with 24px margins.
- **Mobile:** A 2-column fluid grid with 16px margins.

Spacing should be used to group related medical data. Use `lg` (24px) spacing between distinct sections and `sm` (8px) spacing between labels and their corresponding input fields or values.

## Elevation & Depth
The system uses **Tonal Layers** supplemented by **Ambient Shadows** to create a non-threatening sense of hierarchy.

- **Level 0 (Background):** `#F4F5F7` - The canvas for the application.
- **Level 1 (Cards/Surface):** `#FFFFFF` - White surfaces with a soft, 1px border in `#EBECF0`. No shadow.
- **Level 2 (Interactive/Floating):** Used for buttons and active states. A very soft, diffused shadow: `0px 4px 12px rgba(9, 30, 66, 0.08)`.
- **Level 3 (Modals/Overlays):** High-diffusion shadows to focus the patient's attention: `0px 12px 24px rgba(9, 30, 66, 0.15)`.

Avoid heavy blacks; all shadows are tinted with the Deep Slate text color to maintain a cohesive, soft appearance.

## Shapes
The shape language is defined by **Rounded** geometry. 

Standard components (Cards, Input Fields) use a **12px (`rounded-lg`)** corner radius to appear friendly and modern. Smaller elements like tags or small buttons use **8px (`rounded-md`)**. This softness counters the "sterile" feeling of traditional medical software, making the interface feel more approachable and "human."

## Components

### Buttons
- **Primary:** Medical Blue fill, White text, 8px radius. Subtle shadow on hover.
- **Secondary:** Light Blue (#E3F2FD) fill, Primary Blue text. No shadow.
- **Ghost:** Transparent fill, Primary Blue text. Used for less frequent actions.

### Cards
Cards are the primary container for patient data. They must feature a 1px border (#EBECF0), 16px padding, and 12px radius. Content inside should be grouped by 8px or 16px vertical spacing.

### Input Fields
- **Default:** White background, 1px Slate Grey border, 8px radius. 
- **Focus:** 2px Primary Blue border with a soft blue outer glow.
- **Validation:** Use semantic Red (#DE350E) for error text and borders, ensuring clear icon accompaniment for accessibility.

### Chips & Status Indicators
Small, 8px radius badges. 
- **Available:** Light Green background with Dark Green text.
- **Pending:** Light Amber background with Dark Amber text.
- **Icons:** Use 20px line icons with a 2px stroke weight for all UI actions to maintain a consistent, airy feel.

### Lists
Lists of doctors or appointments should use a "Thin Divider" style—1px line separators (#EBECF0) with 16px of vertical padding per item to ensure touch targets are large enough for mobile use.