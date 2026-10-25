
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

function App() {
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

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === "Pending").length,
      progress: tasks.filter(
        (task) => task.status === "In Progress"
      ).length,
      completed: tasks.filter(
        (task) => task.status === "Completed"
      ).length,
      overdue: tasks.filter((task) => {
        if (!task.dueDate || task.status === "Completed") {
          return false;
        }

        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);

        return due < today;
      }).length,
    };
  }, [tasks]);

  const visibleTasks = tasks.filter((task) => {
    const matchesFilter = filter === "All" || task.status === filter;
    const query = search.trim().toLowerCase();

    const matchesSearch =
      (task.title || "").toLowerCase().includes(query) ||
      (task.description || "").toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

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

  if (!token || !user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
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
    <div className="flexi-app">
      <aside className="sidebar">
        <a className="brand" href="#dashboard">
          <span className="brand-icon">F</span>
          FLEXI
        </a>

        <p className="nav-label">WORKSPACE</p>

        <a className="nav-link active" href="#dashboard">
          ▦ Dashboard
        </a>

        <a
          className="nav-link"
          href="#task-form"
          onClick={startNewTask}
        >
          ＋ Create task
        </a>

        <a className="nav-link" href="#task-list">
          ☷ All tasks
        </a>

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
                <h2>Your Tasks</h2>
                <p>Tasks belonging to your account.</p>
              </div>

              <span className="count-pill">
                {visibleTasks.length} tasks
              </span>
            </div>

            <input
              className="search-input"
              aria-label="Search tasks"
              placeholder="Search tasks..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="filter-row">
              {["All", "Pending", "In Progress", "Completed"].map(
                (item) => (
                  <button
                    type="button"
                    key={item}
                    className={`filter-button ${
                      filter === item ? "selected" : ""
                    }`}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                )
              )}
            </div>

            {error && (
              <p className="message error-message" role="alert">
                {error}
              </p>
            )}

            {notice && (
              <p className="message success-message" role="status">
                {notice}
              </p>
            )}

            {loading ? (
              <p className="empty-state">Loading tasks...</p>
            ) : visibleTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">☷</div>
                <h3>No tasks found</h3>
                <p>Create a task or change your search and filters.</p>
              </div>
            ) : (
              <div className="task-list">
                {visibleTasks.map((task) => {
                  const completed = task.status === "Completed";

                  const dueDate = task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString()
                    : "No deadline";

                  return (
                    <article
                      className={`task-card ${
                        completed ? "task-completed" : ""
                      }`}
                      key={task._id}
                    >
                      <div className="task-card-top">
                        <div className="task-title-area">
                          <div className="task-title-row">
                            <span
                              className={`task-completion-indicator ${
                                completed ? "is-complete" : ""
                              }`}
                              aria-label={
                                completed
                                  ? "Task completed"
                                  : "Task not completed"
                              }
                              title={
                                completed ? "Completed" : "Not completed"
                              }
                            >
                              {completed ? "✓" : ""}
                            </span>

                            <h3>{task.title}</h3>
                          </div>

                          {task.description && (
                            <p>{task.description}</p>
                          )}
                        </div>

                        <span
                          className={`priority ${
                            (task.priority || "Medium").toLowerCase()
                          }`}
                        >
                          {task.priority || "Medium"}
                        </span>
                      </div>

                      <div className="task-card-bottom">
                        <div className="task-meta">
                          <span>◷ {dueDate}</span>

                          <select
                            value={task.status || "Pending"}
                            aria-label={`Status for ${task.title}`}
                            onChange={(event) =>
                              changeStatus(task, event.target.value)
                            }
                          >
                            <option>Pending</option>
                            <option>In Progress</option>
                            <option>Completed</option>
                          </select>
                        </div>

                        <div className="task-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => startEditing(task)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="text-button delete-button"
                            onClick={() => deleteTask(task._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
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
              <select
                id="priority"
                name="priority"
                value={form.priority}
                onChange={updateTaskField}
              >
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
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={updateTaskField}
              >
                <option>Pending</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>

              <button
                type="submit"
                className="primary-button full-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Create Task"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditing}
                >
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
