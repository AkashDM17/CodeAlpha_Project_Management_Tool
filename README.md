# TaskFlow &ndash; Collaborative Project Management Tool

> **"Plan. Collaborate. Complete."**  
> A modern, full-stack, real-time project management and team collaboration platform built for **CodeAlpha Internship – Task 3**.

---

## 📖 Overview

**TaskFlow** is an enterprise-grade project management platform inspired by the agility of Trello and the structure of Asana, tailored with unique branding and a focused developer experience. It empowers teams to organize projects, track workflows across visual Kanban boards with drag-and-drop, communicate in real-time within task cards, and receive instant live WebSocket updates.

Built **strictly with pure HTML5, CSS3, and Vanilla JavaScript** on the frontend (no heavy frameworks) and a high-performance **Node.js, Express, MongoDB, and Socket.IO** backend.

---

## ⚡ Key Features

- 🔐 **Authentication & Security**:
  - Secure registration and login with bcrypt password hashing (12 salt rounds)
  - JWT token authentication with `Authorization: Bearer <token>`
  - 1-Click quick login buttons for 5 pre-configured demo team personas
  - Profile customization (name, bio, custom avatar URL)

- 📁 **Project Management**:
  - Create, view, update, and delete group projects
  - Role-based permissions: Project Owners and Team Members
  - Invite and remove team members dynamically with instant notifications
  - Visual color badges, date trackers, and automatic project progress bar calculation

- 📋 **Visual Kanban Board & Task Cards**:
  - Interactive 4-stage pipeline: **To Do**, **In Progress**, **In Review**, **Completed**
  - Native **HTML5 Drag-and-Drop** between columns with automatic position and status synchronization
  - Task priority tags (**Urgent**, **High**, **Medium**, **Low**) with distinct visual badges
  - Due date tracking, assignee avatar indicators, and comment counter badges

- 💬 **In-Task Collaboration & Real-Time Comments**:
  - Threaded comment discussions with timestamps and user avatars
  - Instant WebSocket broadcasting: teammates see new comments appear live without refreshing
  - Role-aware comment management (users delete own comments, project owners can moderate)

- 🔔 **Real-Time Notifications & WebSocket Live Sync**:
  - Socket.IO rooms for projects (`project_:id`) and users (`user_:id`)
  - Live toast notifications for task assignment, status movement, comments, and member invites
  - Unread notification counter badge with quick dropdown and "Mark all as read" capability
  - Visual **Live Sync** pulsing status badge indicating real-time WebSocket connectivity

- 🔍 **Search & Filters**:
  - Global real-time search across projects, task cards, and team members
  - "My Tasks" view with filters for assigned tasks, high priority, and completed items

- 📱 **Responsive Design**:
  - Desktop multi-column layout with sidebar navigation
  - Tablet & mobile optimization with collapsible hamburger sidebar and responsive cards

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (Custom Properties & Glassmorphism), Vanilla JavaScript (ES6+) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB, Mongoose ODM |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| **Real-time WebSockets** | Socket.IO |
| **Styling & Icons** | Plus Jakarta Sans, JetBrains Mono, Pure CSS Design System |

---

## 📂 Project Structure

```
CodeAlpha_Project_Management_Tool/
│
├── controllers/
│   ├── authController.js          # User registration, login, session check
│   ├── projectController.js       # Projects CRUD & member management
│   ├── taskController.js          # Tasks CRUD, status updates, drag & drop
│   ├── commentController.js       # Task comments & socket broadcasts
│   ├── notificationController.js  # User notifications retrieval & read status
│   └── userController.js          # User search and profile updates
│
├── middleware/
│   ├── authMiddleware.js          # JWT verification & protected routes
│   └── errorMiddleware.js         # Centralized error handler & 404 handler
│
├── models/
│   ├── User.js                    # User schema (credentials, bio, avatar)
│   ├── Project.js                 # Project schema with members & virtuals
│   ├── Task.js                    # Task schema (status, priority, position)
│   ├── Comment.js                 # Comment schema linked to tasks
│   └── Notification.js            # Notification schema with recipient & triggers
│
├── routes/
│   ├── authRoutes.js              # /api/auth
│   ├── projectRoutes.js           # /api/projects
│   ├── taskRoutes.js              # /api/tasks
│   ├── commentRoutes.js           # /api/comments
│   ├── notificationRoutes.js      # /api/notifications
│   └── userRoutes.js              # /api/users
│
├── sockets/
│   └── socketHandler.js           # Socket.IO connection & room management
│
├── seed/
│   └── seedData.js                # Database seeder (5 users, 3 projects, 16+ tasks)
│
├── public/
│   ├── index.html                 # Single Page Application entry
│   ├── css/
│   │   └── style.css              # Glassmorphic SaaS design system
│   └── js/
│       ├── api.js                 # Fetch API wrapper with JWT Bearer
│       ├── socket.js              # Socket.IO client manager
│       ├── auth.js                # Authentication controller & demo logins
│       └── app.js                 # View router, Kanban drag-and-drop, modals
│
├── .env                           # Environment configuration
├── .gitignore                     # Git ignore rules
├── package.json                   # Dependencies & run scripts
├── server.js                      # Express HTTP & Socket.IO server bootstrap
└── README.md                      # Comprehensive documentation
```

---

## 🗄️ Database Schemas

### 1. User
- `name` (String, required)
- `username` (String, unique, required)
- `email` (String, unique, required)
- `password` (String, hashed with bcrypt)
- `profileImage` (String, avatar URL)
- `bio` (String)

### 2. Project
- `name` (String, required)
- `description` (String)
- `owner` (ObjectId -> User, required)
- `members` (Array of `{ user: ObjectId, role: 'owner' | 'member' }`)
- `startDate` & `dueDate` (Date)
- `status` (`active`, `completed`, `on-hold`)
- `color` (Hex string)

### 3. Task
- `project` (ObjectId -> Project, required)
- `title` (String, required)
- `description` (String)
- `assignedTo` (ObjectId -> User)
- `createdBy` (ObjectId -> User)
- `priority` (`low`, `medium`, `high`, `urgent`)
- `status` (`todo`, `in-progress`, `in-review`, `completed`)
- `position` (Number for drag-and-drop ordering)
- `dueDate` (Date)

### 4. Comment
- `task` (ObjectId -> Task, required)
- `user` (ObjectId -> User, required)
- `text` (String, required)

### 5. Notification
- `recipient` (ObjectId -> User, required)
- `sender` (ObjectId -> User)
- `type` (`task_assigned`, `task_status_changed`, `comment_added`, `member_added`, `member_removed`)
- `message` (String, required)
- `project` (ObjectId -> Project)
- `task` (ObjectId -> Task)
- `isRead` (Boolean, default: false)

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` &ndash; Create a new user account
- `POST /api/auth/login` &ndash; Login user and retrieve JWT token
- `GET /api/auth/me` &ndash; Get current authenticated user profile

### Projects
- `GET /api/projects` &ndash; List all projects where user is a member (supports `?search=`)
- `POST /api/projects` &ndash; Create a new project
- `GET /api/projects/:id` &ndash; Retrieve project details, member list & progress
- `PUT /api/projects/:id` &ndash; Update project metadata (owner only)
- `DELETE /api/projects/:id` &ndash; Delete project and cascaded tasks (owner only)
- `POST /api/projects/:id/members` &ndash; Add member to project
- `DELETE /api/projects/:id/members/:userId` &ndash; Remove member from project

### Tasks
- `GET /api/projects/:projectId/tasks` &ndash; Get all tasks in project (supports `?status=&priority=&assignedTo=`)
- `POST /api/projects/:projectId/tasks` &ndash; Create task in project
- `GET /api/tasks` &ndash; Get all tasks for current user across projects
- `GET /api/tasks/:id` &ndash; Get single task details
- `PUT /api/tasks/:id` &ndash; Update task title, description, priority, etc.
- `DELETE /api/tasks/:id` &ndash; Delete task
- `PUT /api/tasks/:id/status` &ndash; Update task status & position (drag-and-drop)
- `PUT /api/tasks/:id/assign` &ndash; Assign task to user

### Comments
- `GET /api/tasks/:taskId/comments` &ndash; Get comments for a task
- `POST /api/tasks/:taskId/comments` &ndash; Add comment to task
- `DELETE /api/comments/:id` &ndash; Delete comment (comment owner or project owner)

### Notifications
- `GET /api/notifications` &ndash; List user notifications & unread count
- `PUT /api/notifications/:id/read` &ndash; Mark specific notification as read
- `PUT /api/notifications/read-all` &ndash; Mark all notifications as read
- `DELETE /api/notifications/:id` &ndash; Dismiss notification

### Users
- `GET /api/users` &ndash; Search user directory (supports `?search=`)
- `GET /api/users/:id` &ndash; Get public user profile & activity counts
- `PUT /api/users/:id` &ndash; Update profile details

---

## 🔄 Real-Time WebSocket Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `joinProject` | Client &rarr; Server | `projectId` | Joins room `project_:projectId` |
| `leaveProject` | Client &rarr; Server | `projectId` | Leaves room `project_:projectId` |
| `joinUser` | Client &rarr; Server | `userId` | Joins private user room `user_:userId` |
| `taskCreated` | Server &rarr; Room | `{ task }` | Emitted when a new task is created |
| `taskUpdated` | Server &rarr; Room | `{ task }` | Emitted when task attributes change |
| `taskMoved` | Server &rarr; Room | `{ task, previousStatus }` | Emitted on drag-and-drop status update |
| `taskDeleted` | Server &rarr; Room | `{ taskId, projectId }` | Emitted when a task is deleted |
| `commentAdded` | Server &rarr; Room | `{ taskId, comment }` | Emitted when a new comment is posted |
| `commentDeleted`| Server &rarr; Room | `{ taskId, commentId }` | Emitted when a comment is deleted |
| `memberAdded` | Server &rarr; Room | `{ project, newMember }`| Emitted when a member joins |
| `memberRemoved`| Server &rarr; Room | `{ projectId, userId }` | Emitted when a member is removed |
| `notificationCreated` | Server &rarr; User | `Notification` | Emitted to specific user on direct triggers |

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- **Node.js** (v16.x or higher)
- **MongoDB** (v5.x or higher running locally on port 27017, or a MongoDB Atlas connection string)

### 2. Clone and Install Dependencies
```bash
# Navigate to project directory
cd CodeAlpha_Project_Management_Tool

# Install packages
npm install
```

### 3. Environment Variables (.env)
Create or check the `.env` file in the root directory:
```env
MONGODB_URI=mongodb://localhost:27017/taskflow
JWT_SECRET=taskflow_super_secret_jwt_key_2024_codealpha
PORT=5000
NODE_ENV=development
```

### 4. Seed the Database
Populate 5 demo users, 3 projects, 16+ tasks, comments, and notifications:
```bash
npm run seed
```

### 5. Start the Application
- **Development mode** (with nodemon auto-restart):
  ```bash
  npm run dev
  ```
- **Production mode**:
  ```bash
  npm start
  ```

### 6. Access in Browser
Open your browser at:
```
http://localhost:5000
```

---

## 👤 Demo Credentials

For convenience, 1-Click demo login buttons are provided on the login screen. You can also sign in manually with:

| Persona | Email | Password | Role |
|---|---|---|---|
| **Demo User** | `demo@taskflow.com` | `Demo123` | Project Lead / Admin |
| **Sarah Connor** | `sarah@taskflow.com` | `Demo123` | Senior Frontend Developer |
| **Alex Morgan** | `alex@taskflow.com` | `Demo123` | Backend Architect |
| **Elena Rostova** | `elena@taskflow.com` | `Demo123` | UI/UX Product Designer |
| **David Kim** | `david@taskflow.com` | `Demo123` | QA Engineer |

---

## 🧪 Testing Checklist

- [x] MongoDB database connection & graceful fallback
- [x] User registration with validation and unique checks
- [x] User authentication with JWT and secure password hashing
- [x] Project creation, editing, color customization, and deletion
- [x] Adding and removing project team members
- [x] Kanban board rendering with 4 status columns
- [x] HTML5 drag-and-drop task movement between columns
- [x] In-task real-time threaded discussion and comment deletion
- [x] Real-time WebSocket updates across multiple open browser windows
- [x] Live toast alerts when assignments or comments occur
- [x] Unread notifications dropdown and mark-as-read actions
- [x] Project progress percentage calculation
- [x] Global real-time search across projects and tasks
- [x] Fully responsive layout tested on desktop, tablet, and mobile

---

## 📄 License
This project was built for educational purposes as part of the **CodeAlpha Web Development Internship (Task 3)**.
MIT License &copy; 2026 Akash D M.
