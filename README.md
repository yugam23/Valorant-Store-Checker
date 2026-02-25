<p align="center">
  <img src="public/icons/Valorant_Store_Checker.webp" width="750" alt="Valorant Store Checker Logo">
</p>

# Valorant Store Checker

[![CI](https://github.com/yugam23/Valorant-Store-Checker/actions/workflows/ci.yml/badge.svg)](https://github.com/yugam23/Valorant-Store-Checker/actions/workflows/ci.yml)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yugam23/Valorant-Store-Checker)

A premium Next.js application to check your daily Valorant store, Night Market, and bundles without launching the game.

## Features

- **Daily Store**: View your 4 daily skins with prices.
- **Night Market**: Check your Night Market discounts.
- **Bundle Info**: See current detailed bundle info and pricing.
- **Secure Auth**: Login securely via Riot ID.

## Deployment

This is a full-stack Next.js app. Deploy it on **[Vercel](https://vercel.com)** (recommended, free):

1. Import this repository on [vercel.com/new](https://vercel.com/new).
2. Add the following **Environment Variables** in the Vercel project settings:

   | Variable         | Description                                                                |
   | ---------------- | -------------------------------------------------------------------------- |
   | `SESSION_SECRET` | A strong random secret (min 32 chars). Generate: `openssl rand -base64 32` |
   | `HENRIK_API_KEY` | Your [Henrik Dev](https://docs.henrikdev.xyz) API key                      |

3. Click **Deploy**. Vercel handles the rest automatically.

> **Note:** Every `git push` to `main` triggers an automatic redeployment on Vercel.

## Local Development

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Create `.env.local`** with the variables above.

3. **Run Development Server**:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Framework**: Next.js 16
- **Styling**: Tailwind CSS v4
- **Authentication**: Custom Riot Auth / iron-session
- **Database**: LibSQL (Turso)
