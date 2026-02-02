# 🎨 Navbar Visual Guide - Quick Reference

## 🖼️ Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo]         [Explore ▾] [For Architects ▾] [How it works]      │
│                                          [Sign In]  [Get Started]   │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓ (hover)
┌─────────────────────────────────────────────────────────────────────┐
│                       MEGA MENU (floating)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌────────────────┐                    ┌──────────────────┐ │  │
│  │  │ BROWSE BY      │                    │  [Image Card 1]  │ │  │
│  │  │ CATEGORY       │                    │                  │ │  │
│  │  │                │                    │  [Image Card 2]  │ │  │
│  │  │ • Residential  │                    │                  │ │  │
│  │  │ • Commercial   │                    │  [Image Card 3]  │ │  │
│  │  │ • Interior     │                    │                  │ │  │
│  │  │ • Landscape    │                    └──────────────────┘ │  │
│  │  │                │                                          │  │
│  │  │ POPULAR        │                                          │  │
│  │  │ • Trending     │                                          │  │
│  │  │ • New          │                                          │  │
│  │  │ • Best Sellers │                                          │  │
│  │  └────────────────┘                                          │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Color Palette

```css
Background:        #FAFAF9  (Off-white, warm neutral)
Text Primary:      slate-900 (#0f172a)
Text Secondary:    slate-700 (#334155)
Hover Background:  slate-100/50 (Semi-transparent)
CTA Button:        slate-900 (Dark, high contrast)
Border:            slate-200/60 (Semi-transparent)
Overlay:           slate-900/5 (5% opacity)
```

---

## 📏 Spacing & Sizing

### Navbar
- Height: `72px` (including padding)
- Max width: `1400px`
- Padding: `py-3.5 px-6`
- Gap between items: `gap-1`

### Mega Menu
- Width: `900px`
- Padding: `p-8` (32px all sides)
- Border radius: `20px`
- Top offset: `72px` (navbar height)
- Shadow: `0 20px 60px rgba(0,0,0,0.12)`

### Image Cards
- Width: `320px`
- Height: `140px` each
- Gap: `12px` (space-y-3)
- Border radius: `12px` (rounded-xl)

---

## 🎯 Interactive States

### Navigation Items
```
Default:  px-4 py-2, slate-700, font-medium
Hover:    slate-900, bg-slate-100/50
Active:   (mega menu open)
```

### CTA Button (Get Started)
```
Default:  bg-slate-900, text-white, rounded-full
Hover:    bg-slate-800, shadow-md
Size:     px-5 py-2.5, font-semibold
```

### Image Cards
```
Default:  shadow-md
Hover:    shadow-xl, scale-[1.02], gradient overlay
```

---

## ⏱️ Animation Timing

```javascript
Hover Intent Delay:    100ms  (enter mega menu)
Close Delay:           150ms  (exit mega menu)
Transition Duration:   150-200ms (all elements)
Card Transform:        300ms (hover effects)
Backdrop Fade:         200ms (overlay)
```

---

## 📱 Responsive Behavior

### Desktop (≥ 1024px)
```
✅ Full horizontal navbar
✅ Mega menu with hover
✅ Image cards visible
✅ All navigation items shown
```

### Mobile (< 1024px)
```
✅ Hamburger menu
✅ Slide-in drawer
✅ Stacked navigation
✅ Full-width buttons
✅ Nested architect section
```

---

## 🎭 Mega Menu Components

### Explore Menu
**Left Column:**
- Browse by Category section
- Popular section
- 7 total links

**Right Column:**
- 3 vertical image cards
- Gradient backgrounds
- Hover scale effects

### For Architects Menu
**Left Column:**
- Get Started section
- Resources section
- Primary CTA button
- 7 total links + button

**Right Column:**
- 3 vertical image cards
- Same styling as Explore

---

## 🔄 State Management

### Mega Menu States
```typescript
type MegaMenuType = 'explore' | 'architects' | null;

activeMegaMenu: null        // Closed
activeMegaMenu: 'explore'   // Explore menu open
activeMegaMenu: 'architects' // Architects menu open
```

### User States
```typescript
isAuthenticated: false  // Show: Explore, For Architects, How it works
isAuthenticated: true   // Show: Role-specific nav + user dropdown
```

---

## 🎨 Typography

```css
Logo:           17px, font-semibold, tracking-tight
Nav Items:      14px, font-medium
Section Title:  12px, font-semibold, uppercase, tracking-wider
Menu Links:     15px, font-medium
CTA Button:     14px, font-semibold
Mobile:         14px, font-medium
```

---

## ✨ Special Effects

### Backdrop Overlay
```css
Fixed overlay with backdrop-blur-[2px]
Background: slate-900/5
Fade-in animation: 200ms
Click to close mega menu
```

### Image Card Hover
```css
Transform: scale(1.02)
Shadow: md → xl
Gradient overlay fades in
Duration: 300ms
```

### Smooth Entry
```css
Mega menu: fade-in + slide-in-from-top-2
Duration: 200ms
Easing: Default (ease)
```

---

## 🎯 Navigation Links

### Logged Out Users
```
Explore → /explore (mega menu)
For Architects → (mega menu with links)
  └─ Sell designs → /sell
  └─ How it works → /how-it-works#architects
  └─ Pricing → /pricing
  └─ Resources → /resources/*
  └─ Start selling → /register?role=architect
How it works → /how-it-works
Sign In → /login
Get Started → /register
```

### Authenticated Architects
```
Explore → /explore (mega menu)
Dashboard → /architect/dashboard
My Designs → /architect/designs
Earnings → /architect/earnings
[Avatar] → Dropdown
  └─ Account Settings → /architect/account
  └─ Sign out → (logout)
```

### Authenticated Buyers
```
Explore → /explore (mega menu)
My Purchases → /buyer/purchases
[Avatar] → Dropdown
  └─ My Purchases → /buyer/purchases
  └─ Account Settings → /buyer/account
  └─ Sign out → (logout)
```

---

## 🎨 Shadow Levels

```css
Navbar (scrolled):  shadow-[0_1px_3px_rgba(0,0,0,0.04)]
Mega Menu:          shadow-[0_20px_60px_rgba(0,0,0,0.12)]
User Dropdown:      shadow-[0_8px_30px_rgba(0,0,0,0.12)]
Image Cards:        shadow-md (default), shadow-xl (hover)
CTA Button:         shadow-sm (default), shadow-md (hover)
```

---

## 🎯 Best Practices

✅ **Hover Intent**: 100ms delay prevents accidental triggers
✅ **Smooth Exit**: 150ms delay allows mouse travel
✅ **Clear Hierarchy**: Section titles distinguish content groups
✅ **Visual Feedback**: All interactive elements have hover states
✅ **Accessibility**: High contrast, readable font sizes
✅ **Performance**: CSS transitions, no JavaScript animations
✅ **Mobile First**: Responsive from the ground up

---

## 🚀 Quick Test Checklist

- [ ] Hover over "Explore" - Mega menu appears smoothly
- [ ] Hover over "For Architects" - Different mega menu appears
- [ ] Move mouse to mega menu - Menu stays open
- [ ] Move mouse away - Menu closes after delay
- [ ] Click overlay - Menu closes immediately
- [ ] Hover image cards - Scale and shadow effects work
- [ ] Click "Get Started" - Button has hover effect
- [ ] Mobile: Hamburger opens drawer menu
- [ ] User avatar dropdown works (when logged in)

---

**Visual Style:** Modern SaaS (Stripe/Linear/Engine-inspired)
**Implementation:** Complete and production-ready
**Status:** ✅ Live at http://localhost:3000
