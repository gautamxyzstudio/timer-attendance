import { useEffect, useState } from "react";
import api from "./api";

const AddTask = ({ workLogId, onTaskAdded }) => {
  const [taskTitle, setTaskTitle] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= FETCH PROJECTS ================= */
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get("/projects/myProjects");
        setProjects(res.data || []);
      } catch {
        setError("Failed to load projects");
      }
    };
    fetchProjects();
  }, []);

  /* ================= ADD TASK ================= */
  const handleAddTask = async () => {
    if (!workLogId) {
      setError("Today's work log not found");
      return;
    }

    if (!taskTitle.trim()) {
      setError("Task title is required");
      return;
    }

    if (!projectId) {
      setError("Please select a project");
      return;
    }

    // 🔹 TEMP TASK (for instant UI)
    const tempId = `temp-${Date.now()}`;
    const tempTask = {
      task_id: tempId,
      task_title: taskTitle.trim(),
      project: projects.find((p) => p.id === Number(projectId)),
      status: "in-progress",
      time_spent: 0,
      is_running: false,
      createdAt: new Date().toISOString(),
      __temp: true,
    };

    // 🚀 ADD TO UI IMMEDIATELY
    onTaskAdded?.(tempTask);

    try {
      setLoading(true);
      setError("");

      const res = await api.post(
        `/work-logs/${workLogId}/add-task`,
        {
          data: {
            task_title: taskTitle.trim(),
            project: Number(projectId),
          },
        }
      );

      const updatedTasks = res.data?.tasks || [];
      const realTask = updatedTasks.at(-1);

      // 🔁 REPLACE TEMP TASK WITH REAL ONE
      if (realTask) {
        onTaskAdded?.(realTask, tempId);
      }

      setTaskTitle("");
      setProjectId("");
    } catch (err) {
      // ❌ ROLLBACK TEMP TASK
      onTaskAdded?.(null, tempId);

      setError(
        err.response?.data?.message || "Failed to add task"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="w-full max-w-xl space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* TASK INPUT */}
        <input
          type="text"
          placeholder="Enter task"
          value={taskTitle}
          onChange={(e) => {
            setTaskTitle(e.target.value);
            if (error) setError("");
          }}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none"
        />

        {/* PROJECT SELECT */}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-[13px] outline-none"
        >
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        {/* ADD BUTTON */}
        <button
          onClick={handleAddTask}
          disabled={loading || !workLogId}
          className="rounded-md px-4 py-2 text-sm text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF7300" }}
        >
          {loading ? "Adding..." : "Add Task"}
        </button>
      </div>

      {/* INFO */}
      {!workLogId && (
        <p className="text-xs text-gray-500">
          ⚠️ Today’s work log not found
        </p>
      )}

      {/* ERROR */}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
};

export default AddTask;
