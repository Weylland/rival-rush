<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RivalRush

App web de mini-jeux en duel. Les joueurs s'affrontent depuis leur téléphone en temps réel.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript 5** strict
- **Tailwind CSS v4** (`@theme inline`, tokens dans globals.css)
- **Supabase** (PostgreSQL + Realtime + Auth custom pseudo/mdp)
- **ESLint 9** + **Prettier 3**
- **pnpm 10**

## Commandes

```bash
pnpm dev      # dev server port 3000
pnpm build    # build prod
pnpm lint     # ESLint
pnpm format   # Prettier --write
```

## Structure

```
src/
├── app/
│   ├── layout.tsx                 # Fonts Righteous + Nunito, metadata
│   ├── globals.css                # @theme tokens, keyframes, @utility
│   ├── page.tsx                   # redirect /login
│   ├── (auth)/
│   │   └── login/page.tsx         # Inscription / Connexion
│   └── (game)/
│       ├── lobby/page.tsx         # Liste joueurs + défier
│       ├── challenge/page.tsx     # Défi reçu / attente
│       ├── play/
│       │   ├── pfc/page.tsx       # Pierre Feuille Ciseaux
│       │   └── morpion/page.tsx   # Morpion
│       ├── result/page.tsx        # Résultat partie
│       └── ranking/page.tsx       # Classement
├── components/
│   ├── ui/                        # Primitives Y2K (RRButton, Avatar, Blob, Star…)
│   └── game/                      # Composants jeux (PFCChoice, MorpionCell, PlayerRow…)
├── lib/
│   └── supabase/
│       ├── client.ts              # createBrowserClient
│       └── server.ts              # createServerClient (RSC)
└── types/
    └── database.ts                # Types DB + game state
supabase/
└── schema.sql                     # DDL complet à coller dans l'éditeur SQL Supabase
```

## Design system

Vibe Y2K festif.

### Palette (CSS variables → Tailwind auto)
- `violet` `#2D1B8E` — fond principal
- `violet-deep` `#1A0F5E` — fond sombre, ink
- `cyan` `#00D4E8` — accent principal
- `pink` `#FF1E8C` — CTA, rose Y2K
- `butter` `#FFE94A` — highlight, badges
- `ink` `#1A0F5E` — bordures, texte sombre

### Polices (next/font auto-hébergées)
- **Righteous** (`font-display`) — titres, labels, scores
- **Nunito** (`font-sans`) — corps, UI

### Tokens visuels
- Fond : violet `#2D1B8E` + dot pattern cyan (radial-gradient 16px)
- Blobs SVG organiques en coins
- Stars Y2K 4 branches (SVG)
- Bordures : `2px solid #1A0F5E` standard, `2.5px` cards, `3px` modaux
- Shadows offset solide : `4px 4px 0 {color}` (brutal, sans blur)
- `skewX(-8deg)` sur les titres, `skewX(-4deg)` sur les boutons
- Rotation alternée sur les cards (±0.5°)

### Animations
- `rr-blink` — curseur texte
- `rr-pulse` — point de présence online
- `rr-float` — éléments décoratifs
- `rr-bounce` — feedback victoire
- `rr-glow-pulse` — CTA principal

## Base de données

Schema dans `supabase/schema.sql`. 4 tables + 1 vue :
- `players` — pseudo + password hashé (pgcrypto)
- `challenges` — défis entre joueurs
- `games` — état de la partie en jsonb
- `leaderboard` — victoires/défaites/points
- `presence` — joueurs en ligne (Realtime)

**Realtime** : activer dans Supabase dashboard sur `presence`, `challenges`, `games`.

## Auth

Pas d'email. Pseudo + mot de passe hashé côté app (pas Supabase Auth). Le player_id est stocké en cookie session. Vérifier en Server Component via `createClient()` dans `lib/supabase/server.ts`.

## Conventions

- Server Components par défaut, `"use client"` pour state/events/Realtime subscriptions
- Toujours lire `shared.jsx` avant de créer un composant UI
- Mobile-first (375px de base)
- Pas de `border-radius` nul — les coins sont arrondis et cohérents (14–28px selon la taille)
