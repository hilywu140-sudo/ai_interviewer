# AI Interview Coach - Frontend

Next.js frontend for AI Interview Coach MVP.

## Prerequisites

- Node.js 18+
- npm or yarn

## Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

Create `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
frontend/
├── app/                    # Next.js 13+ App Router
│   ├── page.tsx            # Home page
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Global styles
│   ├── projects/           # Projects pages
│   │   ├── page.tsx        # Projects list
│   │   ├── new/            # Create project
│   │   └── [id]/           # Project detail
│   └── practice/           # Practice room (Phase 2)
├── components/             # React components
├── lib/                    # Utilities
│   ├── api-client.ts       # API client
│   └── types.ts            # TypeScript types
├── hooks/                  # Custom hooks
└── public/                 # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Phase 1 Features

- ✅ Project management (create, list, view)
- ✅ Resume upload (PDF)
- ✅ JD input
- ✅ Practice questions configuration

## Next Steps (Phase 2)

- WebSocket integration for real-time chat
- Interview modal with recording
- Feedback display
- Answer rewriting interface
