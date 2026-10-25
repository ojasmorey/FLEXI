
const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Item");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// All routes below require authentication
router.use(authMiddleware);

// GET: Retrieve only the logged-in user's tasks
router.get("/", async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.userId })
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tasks." });
  }
});

// POST: Create a task for the logged-in user
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description = "",
      priority = "Medium",
      dueDate,
      status = "Pending",
    } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Task title is required.",
      });
    }

    const task = await Task.create({
      title: title.trim(),
      description,
      priority,
      dueDate: dueDate || null,
      status,
      user: req.userId,
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to create task.",
    });
  }
});

// PUT: Update only a task owned by the logged-in user
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const updates = {};
    const allowedFields = [
      "title",
      "description",
      "priority",
      "dueDate",
      "status",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (typeof updates.title === "string") {
      updates.title = updates.title.trim();

      if (!updates.title) {
        return res.status(400).json({
          message: "Task title cannot be empty.",
        });
      }
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to update task.",
    });
  }
});

// DELETE: Delete only a task owned by the logged-in user
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete task." });
  }
});

module.exports = router;
