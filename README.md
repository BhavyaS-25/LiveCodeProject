# CodeCollab

CodeCollab is a real-time live collaborative code editor platform allowing multiple users to work on the same project/file at the same time. The platform supports file management, live cursor tracking for users and real-time updates through the use of WebSockets.

The project demonstrates full-stack development, real-time systems, and authentication workflows.

## Features
- User Authentication (register + login)
  - JWT-based auth
- Project dashboard
  - Create projects and manage files
  - Navigate through files via sidebar
- Real-Time Collaboration
  - Live code syncing using WebSockets
  - Presence tracking to see who is editing
  - Colored cursor indicators   
- Code Editor
  - Monaco Editor to give a VS Code style
  - Syntax higlighitng for 9 different languages
- Auto-Save
  Debounced edits synced to backend.
- Clean UI
  -  Editor is styled with both a side and status bar. 
  

## Tech Stack
- Frontend: Next.js, React, CSS, Type Script, Monaco Editor
- Backend: FastAPI (Python), WebSockets, JWT Authentication, REST APIs
- Database: (Postgres/SQLite)

## Project Structure:
LiveCodeProject/
├── frontend/
│   ├── app/
│   │   ├── login/
│   │   ├── projects/
│   │   └── page.tsx
│   ├── components/
│   ├── styles/
│   └── globals.css
│
├── backend/
│   ├── main.py
│   ├── auth/
│   ├── projects/
│   └── websocket/
│
└── README.md

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started
1. Clone the repo:
   git clone https://github.com/BhavyaS-25/LiveCodeProject.git
   cd LiveCodeProject
2. Setup Backend
   cd backend
   python -m venv venv
   source venv/bin/activate   # macOS/Linux
   venv\Scripts\activate      # Windows
3. Install dependencies
   pip install -r requirements.txt
4. Run the backend
   uvicorn main:app --reload
   Backend will run at http://localhost:8000
5. Setup Frontend
   cd frontend
   npm install
   npm run dev

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
