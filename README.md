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
   cd frontend-clean
   npm install
   npm run dev

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication Flow
Register: POST /auth/register
Login: POST /auth/login


## 🧪 Example Usage
Register an account on the home page
Login and create a project
Add files to the project
Open the same file in multiple browsers
Watch edits and cursors sync in real time


## 🚧 Known Limitations / Future Improvements
🔹 Run code execution (e.g., Python files)
🔹 File creation & deletion UI
🔹 Better conflict resolution
🔹 User permissions (read/write roles)
🔹 Deployment (Docker / Vercel / Railway)

## 📌 What This Project Demonstrates
Full-stack system design
Real-time WebSocket communication
REST + WebSocket integration
Authentication & protected routes
Scalable editor architecture
This project was built to strengthen skills in distributed systems, real-time applications, and modern web development.

## Author 
Bhavya Shah 
GitHub: BhavyaS-25



