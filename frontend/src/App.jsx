
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";
const AUTH_API = `${API}/auth`;
const TASKS_API = `${API}/items`;

const EMPTY_FORM = {
  title: "",
  description: "",
  priority: "Medium",
  dueDate: "",
  status: "Pending",
};

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTaskDateKey(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : getLocalDateKey(date);
}

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("flexi_theme") || "dark"
  );

  useEffect(() => {
    localStorage.setItem("flexi_theme", theme);
  }, [theme]);

  const [token, setToken] = useState(
    () => localStorage.getItem("flexi_token") || ""
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("flexi_user") || "null");
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState("All Tasks");
  const [viewMode, setViewMode] = useState("list");
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function logout() {
    localStorage.removeItem("flexi_token");
    localStorage.removeItem("flexi_user");

    setToken("");
    setUser(null);
    setTasks([]);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setNotice("");
    setAuthError("");
  }

  async function authRequest(path, body) {
    const response = await fetch(`${AUTH_API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Authentication failed.");
    }

    return data;
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const path = authMode === "register" ? "register" : "login";

      const payload =
        authMode === "register"
          ? authForm
          : {
              email: authForm.email,
              password: authForm.password,
            };

      const data = await authRequest(path, payload);

      localStorage.setItem("flexi_token", data.token);
      localStorage.setItem("flexi_user", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
      setNotice(
        authMode === "register"
          ? "Your account was created successfully."
          : "Welcome back."
      );
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      logout();
      throw new Error("Your session expired. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }

  async function loadTasks() {
    if (!token) return;

    setLoading(true);

    try {
      const data = await apiRequest(TASKS_API);
      setTasks(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && user) {
      loadTasks();
    }
  }, [token, user]);

  const todayKey = getLocalDateKey();
  const weekEndKey = addDaysToDateKey(todayKey, 7);

  const stats = useMemo(() => {
    const overdueTasks = tasks.filter((task) => {
      const dueKey = getTaskDateKey(task.dueDate);
      return Boolean(
        dueKey && dueKey < todayKey && task.status !== "Completed"
      );
    });

    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === "Pending").length,
      progress: tasks.filter((task) => task.status === "In Progress").length,
      completed: tasks.filter((task) => task.status === "Completed").length,
      overdue: overdueTasks.length,
    };
  }, [tasks, todayKey]);

  // Date-based views are derived from real task dates; no extra backend fields are needed.
  const baseVisibleTasks = tasks.filter((task) => {
    const dueKey = getTaskDateKey(task.dueDate);
    const isUnfinished = task.status !== "Completed";
    let matchesView = true;

    if (activeView === "My Day") {
      // Show today's tasks plus unfinished overdue tasks that still need attention.
      matchesView = dueKey === todayKey || Boolean(dueKey && dueKey < todayKey && isUnfinished);
    } else if (activeView === "Upcoming") {
      matchesView = Boolean(dueKey && dueKey > todayKey && dueKey <= weekEndKey && isUnfinished);
    } else if (activeView === "Overdue") {
      matchesView = Boolean(dueKey && dueKey < todayKey && isUnfinished);
    }

    if (!matchesView) return false;

    const query = search.trim().toLowerCase();
    return (
      (task.title || "").toLowerCase().includes(query) ||
      (task.description || "").toLowerCase().includes(query)
    );
  });

  const visibleTasks = baseVisibleTasks.filter(
    (task) => filter === "All" || task.status === filter
  );

  function selectView(view) {
    setActiveView(view);
    setFilter("All");
  }

  function updateTaskField(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const wasEditing = Boolean(editingId);
      const url = wasEditing
        ? `${TASKS_API}/${editingId}`
        : TASKS_API;

      await apiRequest(url, {
        method: wasEditing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          description: form.description.trim(),
          dueDate: form.dueDate || null,
        }),
      });

      setForm(EMPTY_FORM);
      setEditingId(null);
      setNotice(wasEditing ? "Task updated successfully." : "Task created successfully.");

      await loadTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(task) {
    setEditingId(task._id);

    setForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "Medium",
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      status: task.status || "Pending",
    });

    setNotice("");
    setError("");

    document.getElementById("task-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");
  }

  async function deleteTask(id) {
    if (!window.confirm("Delete this task permanently?")) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await apiRequest(`${TASKS_API}/${id}`, {
        method: "DELETE",
      });

      if (editingId === id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }

      setNotice("Task deleted successfully.");
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(task, status) {
    setError("");
    setNotice("");

    try {
      await apiRequest(`${TASKS_API}/${task._id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      setNotice("Task status updated.");
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  function startNewTask() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");

    document.getElementById("task-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function renderTaskCard(task, isBoardCard = false) {
    const completed = task.status === "Completed";
    const dueKey = getTaskDateKey(task.dueDate);
    const overdue = Boolean(dueKey && dueKey < todayKey && !completed);
    const dueDate = dueKey
      ? new Date(`${dueKey}T00:00:00`).toLocaleDateString()
      : "No deadline";

    return (
      <article
        className={`task-card ${completed ? "task-completed" : ""} ${
          overdue ? "task-overdue" : ""
        } ${isBoardCard ? "task-card-board" : ""} ${
          draggedTaskId === task._id ? "is-dragging" : ""
        }`}
        key={task._id}
        draggable={isBoardCard}
        onDragStart={
          isBoardCard
            ? (event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", task._id);
                setDraggedTaskId(task._id);
              }
            : undefined
        }
        onDragEnd={() => setDraggedTaskId(null)}
      >
        <div className="task-card-top">
          <div className="task-title-area">
            <div className="task-title-row">
              <span
                className={`task-completion-indicator ${
                  completed ? "is-complete" : ""
                }`}
                aria-label={completed ? "Task completed" : "Task not completed"}
                title={completed ? "Completed" : "Not completed"}
              >
                {completed ? "✓" : ""}
              </span>
              <h3>{task.title}</h3>
            </div>
            {task.description && <p>{task.description}</p>}
          </div>
          <span className={`priority ${(task.priority || "Medium").toLowerCase()}`}>
            {task.priority || "Medium"}
          </span>
        </div>

        <div className="task-card-bottom">
          <div className="task-meta">
            <span>◷ {dueDate}</span>
            {overdue && <span className="overdue-label">Overdue</span>}
            <select
              value={task.status || "Pending"}
              aria-label={`Status for ${task.title}`}
              onChange={(event) => changeStatus(task, event.target.value)}
            >
              <option>Pending</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          </div>
          <div className="task-actions">
            <button type="button" className="text-button" onClick={() => startEditing(task)}>
              Edit
            </button>
            <button type="button" className="text-button delete-button" onClick={() => deleteTask(task._id)}>
              Delete
            </button>
          </div>
        </div>
      </article>
    );
  }

  if (!token || !user) {
    return (
      <main className={`auth-page theme-${theme}`}>
        <section className="auth-card">
          <button
            type="button"
            className="theme-toggle"
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}
          </button>

          <a className="brand auth-brand" href="/">
            <span className="brand-icon">F</span>
            FLEXI
          </a>

          <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>

          <h1>
            {authMode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p className="auth-description">
            {authMode === "login"
              ? "Log in to manage your tasks and stay organized."
              : "Create an account to start organizing your work."}
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === "login" ? "selected" : ""}
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
            >
              Log in
            </button>

            <button
              type="button"
              className={authMode === "register" ? "selected" : ""}
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
              }}
            >
              Register
            </button>
          </div>

          <form className="task-form" onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <>
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  value={authForm.name}
                  onChange={(event) =>
                    setAuthForm({
                      ...authForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="Your name"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </>
            )}

            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              value={authForm.email}
              onChange={(event) =>
                setAuthForm({
                  ...authForm,
                  email: event.target.value,
                })
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={authForm.password}
              onChange={(event) =>
                setAuthForm({
                  ...authForm,
                  password: event.target.value,
                })
              }
              placeholder="At least 8 characters"
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={8}
              maxLength={128}
              required
            />

            {authError && (
              <p className="message error-message" role="alert">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="primary-button full-button"
              disabled={authLoading}
            >
              {authLoading
                ? "Please wait..."
                : authMode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>

          <p className="auth-footer">
            FLEXI · Flexible Task & Productivity Manager
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className={`flexi-app theme-${theme}`}>
      <aside className="sidebar">
        <a className="brand" href="#dashboard">
          <span className="brand-icon">F</span>
          FLEXI
        </a>

        <p className="nav-label">WORKSPACE</p>

        <button
          type="button"
          className={`nav-link ${activeView === "All Tasks" ? "active" : ""}`}
          onClick={() => selectView("All Tasks")}
        >
          ▦ All Tasks
        </button>
        <button
          type="button"
          className={`nav-link ${activeView === "My Day" ? "active" : ""}`}
          onClick={() => selectView("My Day")}
        >
          ☀ My Day
        </button>
        <button
          type="button"
          className={`nav-link ${activeView === "Upcoming" ? "active" : ""}`}
          onClick={() => selectView("Upcoming")}
        >
          ◷ Upcoming
        </button>
        <button
          type="button"
          className={`nav-link ${activeView === "Overdue" ? "active" : ""}`}
          onClick={() => selectView("Overdue")}
        >
          ⚠ Overdue
        </button>
        <button type="button" className="nav-link" onClick={startNewTask}>
          ＋ Create task
        </button>

        <div className="sidebar-bottom">
          <div className="avatar">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>

          <div className="user-info">
            <strong>{user.name}</strong>
            <p>{user.email}</p>
            <button
              type="button"
              className="text-button"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>Task Dashboard</h1>
          </div>
          <button
  type="button"
  className="theme-toggle"
  onClick={() =>
    setTheme((current) => (current === "dark" ? "light" : "dark"))
  }
  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
  title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
>
  {theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}
</button>


          <button
            type="button"
            className="primary-button"
            onClick={startNewTask}
          >
            + New Task
          </button>
        </header>

        <section className="welcome-panel">
          <div>
            <span className="welcome-tag">YOUR DAY, ORGANIZED</span>
            <h2>Make progress, one task at a time.</h2>
            <p>
              Welcome, {user.name}. Keep your priorities moving forward.
            </p>
          </div>

          <div className="welcome-symbol">✓</div>
        </section>

        <section className="stats-grid">
          <StatCard
            label="Total Tasks"
            value={stats.total}
            symbol="▤"
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            symbol="◷"
          />
          <StatCard
            label="In Progress"
            value={stats.progress}
            symbol="↗"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            symbol="✓"
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            symbol="!"
          />
        </section>

        <section className="content-grid">
          <div className="panel task-panel" id="task-list">
            <div className="panel-heading">
              <div>
                <h2>{activeView}</h2>
                <p>
                  {activeView === "My Day"
                    ? "Tasks due today and overdue tasks that still need attention."
                    : activeView === "Upcoming"
                      ? "Unfinished tasks due in the next seven days."
                      : activeView === "Overdue"
                        ? "Unfinished tasks whose due dates have passed."
                        : "Plan, organize, and track your tasks."}
                </p>
              </div>
              <span className="count-pill">
                {(viewMode === "board" ? baseVisibleTasks : visibleTasks).length} tasks
              </span>
            </div>

            <div className="task-toolbar">
              <input
                className="search-input"
                aria-label="Search tasks"
                placeholder="Search tasks..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="view-switch" role="group" aria-label="Task view">
                <button
                  type="button"
                  className={`view-switch-button ${viewMode === "list" ? "selected" : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                >
                  ☷ List
                </button>
                <button
                  type="button"
                  className={`view-switch-button ${viewMode === "board" ? "selected" : ""}`}
                  onClick={() => {
                    setFilter("All");
                    setViewMode("board");
                  }}
                  aria-pressed={viewMode === "board"}
                >
                  ▦ Board
                </button>
              </div>
            </div>

            {viewMode === "list" && (
              <div className="filter-row">
                {["All", "Pending", "In Progress", "Completed"].map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`filter-button ${filter === item ? "selected" : ""}`}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="message error-message" role="alert">{error}</p>}
            {notice && <p className="message success-message" role="status">{notice}</p>}

            {loading ? (
              <p className="empty-state">Loading tasks...</p>
            ) : viewMode === "board" ? (
              <div className="kanban-board">
                {["Pending", "In Progress", "Completed"].map((status) => {
                  const columnTasks = baseVisibleTasks.filter((task) => task.status === status);
                  return (
                    <section
                      className={`kanban-column kanban-${status.toLowerCase().replace(/\s+/g, "-")} ${draggedTaskId ? "drop-ready" : ""}`}
                      key={status}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = event.dataTransfer.getData("text/plain");
                        const draggedTask = tasks.find((task) => task._id === id);
                        if (draggedTask && draggedTask.status !== status) {
                          changeStatus(draggedTask, status);
                        }
                        setDraggedTaskId(null);
                      }}
                    >
                      <div className="kanban-column-heading">
                        <span className={`kanban-status-dot dot-${status.toLowerCase().replace(/\s+/g, "-")}`} />
                        <h3>{status}</h3>
                        <span className="kanban-count">{columnTasks.length}</span>
                      </div>
                      <div className="kanban-column-content">
                        {columnTasks.length === 0 ? (
                          <div className="kanban-empty">Drop a task here</div>
                        ) : (
                          columnTasks.map((task) => renderTaskCard(task, true))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : visibleTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">☷</div>
                <h3>No tasks found</h3>
                <p>
                  {activeView === "Upcoming"
                    ? "No unfinished tasks are due in the next seven days."
                    : activeView === "Overdue"
                      ? "You have no overdue unfinished tasks."
                      : activeView === "My Day"
                        ? "Nothing due today. You are all caught up."
                        : "Create a task or change your search and filters."}
                </p>
              </div>
            ) : (
              <div className="task-list">
                {visibleTasks.map((task) => renderTaskCard(task))}
              </div>
            )}
          </div>

          <section className="panel form-panel" id="task-form">
            <div className="panel-heading">
              <div>
                <h2>{editingId ? "Edit Task" : "Create a Task"}</h2>
                <p>
                  {editingId
                    ? "Update your task details."
                    : "Keep your next action clear."}
                </p>
              </div>
            </div>

            <form onSubmit={handleTaskSubmit} className="task-form">
              <label htmlFor="title">Task title *</label>
              <input
                id="title"
                name="title"
                value={form.title}
                onChange={updateTaskField}
                placeholder="e.g. Complete project report"
                maxLength={150}
                required
              />

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={updateTaskField}
                placeholder="Add details..."
                rows={4}
              />

              <label htmlFor="priority">Priority</label>
              <select id="priority" name="priority" value={form.priority} onChange={updateTaskField}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>

              <label htmlFor="dueDate">Due date</label>
              <input
                id="dueDate"
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={updateTaskField}
              />

              <label htmlFor="status">Status</label>
              <select id="status" name="status" value={form.status} onChange={updateTaskField}>
                <option>Pending</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>

              <button type="submit" className="primary-button full-button" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Task"}
              </button>

              {editingId && (
                <button type="button" className="secondary-button" onClick={cancelEditing}>
                  Cancel Editing
                </button>
              )}
            </form>
          </section>
        </section>

        <footer className="page-footer">
          FLEXI · Flexible Task & Productivity Manager
        </footer>
      </main>
    </div>
  );
}

function StatCard({ label, value, symbol }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span>{label}</span>
        <span className="stat-symbol">{symbol}</span>
      </div>
      <strong>{value}</strong>
    </article>
  );
}

export default App;
