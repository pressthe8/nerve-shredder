# Nerve Shredder — Design System

## Aesthetic

Dark, monospace, industrial. Inspired by CRT terminals and high-stakes arcade machines. Angular, not rounded. Tense, not playful.

- Font: monospace throughout (`font-mono`)
- Text style: `font-black italic tracking-tighter` for headlines and amounts
- Background: `bg-neutral-950`
- CRT effects: scanline overlay + vignette always present

## Colour Palette

| Role | Colour | Usage |
|------|--------|-------|
| Action / go | `emerald-600` | START button |
| Danger / bank | `red-600` | BANK button |
| Success | `emerald-400/500` | BANKED state, scores, amounts |
| Failure | `red-500` | CRASH state |
| Neutral action | `neutral-700` | CONTINUE, VIEW RESULTS, BACK TO HOME |
| Weekly/amber | `amber-400` | Weekly scores, streaks |
| Results | `cyan-400` | Final score on FINISHED screen |
| Labels | `neutral-400` | Uppercase tracking labels |

## Button Style

All primary buttons use the same shape and size. **Never use rounded-full or pill shapes for game action buttons.**

```
w-full py-8
font-black text-4xl (or text-2xl for secondary actions) tracking-widest
skew-x-[-12deg] on the button element
skew-x-[12deg] on an inner <span> (counter-skew so text is upright)
active:scale-95 transition-transform
flex items-center justify-center
```

Example (green START):
```jsx
<button className="w-full py-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-4xl tracking-widest shadow-[0_0_50px_rgba(16,185,129,0.5)] active:scale-95 transition-transform flex items-center justify-center skew-x-[-12deg]">
  <span className="inline-block skew-x-[12deg]">START</span>
</button>
```

### Button colours by phase

| Phase | Label | Colour |
|-------|-------|--------|
| IDLE | START | `bg-emerald-600` |
| RUNNING | BANK | `bg-red-600` |
| BANKED | CONTINUE / VIEW RESULTS | `bg-neutral-700` |
| BUSTED | CONTINUE / VIEW RESULTS | `bg-neutral-700` |
| FINISHED | BACK TO HOME | `bg-neutral-700` |

## Game Screen Layout

The game screen uses a fixed two-zone layout for IDLE, RUNNING, BANKED, and BUSTED phases:

```
[ fixed h-48 message area — centered content ]
[ button — always at the same vertical position ]
```

This ensures the button never shifts position between phases, so the player's thumb doesn't need to move from START to BANK.

FINISHED is a special case with more content and uses its own full-height centered layout.

## Typography Scale

| Element | Classes |
|---------|---------|
| Phase headline (BANKED!, CRASH!) | `text-5xl–6xl font-black italic tracking-tighter` |
| Ready prompt | `text-3xl font-black italic tracking-tighter` |
| Amount display | `text-7xl font-mono font-black italic tracking-tighter` |
| Final score | `text-6xl font-mono font-black italic tracking-tighter` |
| Section labels | `text-xs font-bold tracking-[.3em] uppercase` |

## Glow Effects

Use sparingly on key values:
- `text-glow-emerald` — banked amounts, scores
- `text-glow-red` — CRASH headline
- `text-glow-cyan` — final score
- `text-glow-amber` — weekly score
- `shadow-[0_0_50px_rgba(...)]` on buttons to match their colour
