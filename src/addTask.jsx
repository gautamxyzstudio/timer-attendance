import { useEffect, useState, useRef } from "react";
import api from "./api";

/* ================= PROJECT DROPDOWN ================= */

const ProjectDropdown = ({ projects, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const safeProjects = Array.isArray(projects) ? projects : [];

  const selected = safeProjects.find(
    (p) => p.id === Number(value)
  );


  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="
          px-3 py-2 min-w-[150px]
          text-[13px] text-left
          border border-gray-300 rounded-md
          bg-white text-gray-800
          flex items-center justify-between
          whitespace-nowrap
          focus:outline-none focus:border-[#FF7300]
        "
      >
        <span className={selected ? "" : "text-gray-400"}>
          {selected ? selected.title : "Select project"}
        </span>
        <span className="text-xs ml-2">▾</span>
      </button>

      {/* Dropdown Card */}
      {open && (
        <div
          className="
                  absolute z-30 mt-2 min-w-full
      bg-white rounded-xl
      shadow-[0_12px_30px_rgba(0,0,0,0.15)]
      border border-gray-100
      max-h-50 overflow-y-auto h-auto no-scrollbar
          "
        >
          {safeProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
              className="
                px-4 py-2 text-sm cursor-pointer
                hover:bg-[#F4F0FF]
                transition
              "
            >
              {p.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ================= ADD TASK ================= */

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
        setProjects(res.data?.projects || []);
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

      if (realTask) {
        onTaskAdded?.(realTask, tempId);
      }

      setTaskTitle("");
      setProjectId("");
    } catch (err) {
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
      <div className="flex items-center gap-2">
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

        {/* PROJECT DROPDOWN */}
        <ProjectDropdown
          projects={projects}
          value={projectId}
          onChange={setProjectId}
        />

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

      {!workLogId && (
        <p className="text-xs text-gray-500">
          ⚠️ Today’s work log not found
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
};

export default AddTask;
