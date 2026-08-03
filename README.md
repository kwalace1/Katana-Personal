# Katana - Modern SaaS Solution

A modern, fully functional SaaS platform built with React, TypeScript, and Vite featuring a **drag-and-drop Kanban board**.

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

Open your browser to: **http://localhost:3000**

### Build for Production
```bash
npm run build
npm run preview
```

## ✨ Features

### 🎯 Project Management
- **Drag & Drop Kanban Board** - Fully functional drag-and-drop between columns
- Task management with priorities, assignees, deadlines, and progress tracking
- Multiple project views (Board is the main feature)

### 🏢 Modules
- **Hub** - Central dashboard
- **PM** - Project Management with Kanban boards
- **Inventory** - Inventory management
- **CSP** - Customer Success Platform
- **Katana Workforce** - Field service and workforce management
- **HR** - Human Resources
- **Z-MO** - Manufacturing Operations
- **Automation** - Workflow automation

## 📁 Project Structure

```
/
├── src/
│   ├── components/
│   │   ├── ui/              # UI components (Button, Badge, Card)
│   │   ├── projects/
│   │   │   └── KanbanBoard.tsx  # Working drag-and-drop Kanban
│   │   └── Sidebar.tsx      # Navigation sidebar
│   ├── pages/               # All page components
│   │   ├── HomePage.tsx
│   │   ├── ProjectsPage.tsx
│   │   ├── ProjectDetailPage.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── project-data.ts  # Project data and types
│   │   └── utils.ts         # Utility functions
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🎨 Drag & Drop Kanban Board

### How It Works

Navigate to **Projects** → Select a project → See the working Kanban board

**Features:**
- ✅ Drag tasks between 6 status columns
- ✅ Visual feedback (cards become transparent while dragging)
- ✅ Column highlighting when hovering with a task
- ✅ Task details: priority, assignee, deadline, progress
- ✅ Automatic status updates when dropped

### Status Columns
1. Backlog
2. To Do
3. In Progress
4. Review
5. Blocked
6. Done

## 🛠️ Technologies

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Lightning-fast build tool
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icons
- **HTML5 Drag & Drop API** - Native drag-and-drop

## 📝 Key Improvements

### Why This Works (vs the old version):

1. **No Next.js hydration issues** - Pure client-side React
2. **Simple dependency tree** - No Radix UI complexity
3. **Fast dev server** - Vite is much faster than Next.js
4. **Working drag-and-drop** - Proper event handlers with:
   - `draggable={true}` (not just `draggable`)
   - `select-none` class to prevent text selection
   - Proper `preventDefault()` and `stopPropagation()`
   - Boundary detection for drag leave events

## 🎯 Usage

### View Projects
```
http://localhost:3000/projects
```

### View Kanban Board
```
http://localhost:3000/projects/1
```

### Try Drag & Drop
1. Click and hold any task card
2. Drag it to a different column
3. Release to drop
4. Watch the task move!

## 🔧 Customization

### Add Your Own Projects

Edit `src/lib/project-data.ts`:

```typescript
export const mockProjects: Project[] = [
  {
    id: "1",
    name: "Your Project",
    status: "active",
    progress: 50,
    deadline: "2025-12-31",
    tasks: [
      // Add your tasks here
    ],
    // ... other fields
  },
]
```

### Modify Columns

Edit `src/components/projects/KanbanBoard.tsx` - the `statusColumns` array.

## 🐛 Troubleshooting

**Server won't start?**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Port 3000 in use?**

Edit `vite.config.ts` and change the port number.

**Drag-and-drop not working?**

Hard refresh your browser: `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)

## 📄 License

MIT - Free to use and modify!
