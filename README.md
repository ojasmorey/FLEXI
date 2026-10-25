# FLEXI — Task & Productivity Management System

FLEXI is a full-stack task management application designed to help users organize their work, manage priorities, track deadlines, and monitor task completion through a dashboard.

## Features

- **User Authentication** — Register and log in to your account.
- **Task Management** — Create, view, edit, and delete tasks.
- **Task Priorities** — Organize tasks by Low, Medium, and High priority.
- **Status Tracking** — Track tasks as Pending, In Progress, or Completed.
- **Due Dates** — Set deadlines and identify overdue tasks.
- **Dashboard Statistics** — View total, pending, in-progress, completed, and overdue tasks.
- **Completion Indicators** — Visually identify completed tasks.
- **Search and Filtering** — Find tasks by title or description and filter by status.
- **Database Persistence** — Store tasks in MongoDB.
- **User-Specific Tasks** — Authenticated users access their own tasks.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JSON Web Tokens (JWT), bcrypt |
| API | REST API |
| Version Control | Git, GitHub |

## Project Structure

```text
FLEXI/
├── backend/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── .gitignore
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   └── index.html
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running the application:

- Node.js and npm
- MongoDB Community Server running locally, or an accessible MongoDB instance
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ojasmorey/FLEXI.git
cd FLEXI
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/flexi_db
JWT_SECRET=replace_with_a_secure_random_secret
```

Replace the JWT secret with a secure, randomly generated value. Never commit your actual `.env` file.

### 3. Start the backend

```bash
npm start
```

If the backend package does not define a `start` script, check `backend/package.json` and use its configured start command. For a typical setup using `server.js`, you can run:

```bash
node server.js
```

### 4. Configure and start the frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### 5. Database

Ensure MongoDB is running and the `MONGO_URI` value matches your database configuration. MongoDB will store the application data as tasks are created.

## Security Notes

- Keep `.env` files and credentials out of version control.
- Use a strong, randomly generated JWT secret.
- Do not publish database credentials or private tokens.
- Configure appropriate CORS origins before deploying the application.

## Future Improvements

- Deploy the frontend and backend.
- Add task sorting and calendar views.
- Add task reminders and notifications.
- Improve analytics and productivity reporting.
- Add automated tests and continuous integration.

## Author

**Ojas Morey**

GitHub: [@ojasmorey](https://github.com/ojasmorey)

---

Built as a full-stack project to practice frontend development, REST APIs, authentication, database integration, and Git-based version control.
