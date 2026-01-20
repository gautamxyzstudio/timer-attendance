import { useEffect, useState } from "react";
import api from "./api";

const AddTask = ({ workLogId, onTaskAdded }) => {
  const [taskTitle, setTaskTitle] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ✅ FETCH ASSIGNED PROJECTS */
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get("/projects/myProjects");
        setProjects(res.data || []); // ✅ FIXED (plain array)
      } catch {
        setError("Failed to load projects");
      }
    };

    fetchProjects();
  }, []);

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

      const updatedTasks = res.data.tasks || [];
      const newlyAddedTask = updatedTasks.at(-1);

      if (onTaskAdded && newlyAddedTask) {
        onTaskAdded(newlyAddedTask);
      }

      setTaskTitle("");
      setProjectId("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to add task"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* TASK INPUT */}
        <input
          type="text"
          placeholder="Enter task"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-blue-500 outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* PROJECT SELECT */}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-blue-500 outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} {/* ✅ FIXED */}
            </option>
          ))}
        </select>

        {/* ADD BUTTON */}
        <button
          onClick={handleAddTask}
          disabled={loading || !workLogId}
          className="rounded-md bg-blue-300 px-4 py-2 text-sm font-medium text-black
                     hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
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
        <p className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default AddTask;
