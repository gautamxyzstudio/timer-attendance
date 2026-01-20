import { useState } from "react";
import api from "./api";

const AddTask = ({ workLogId, onTaskAdded }) => {
    const [taskTitle, setTaskTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleAddTask = async () => {
        if (!taskTitle.trim()) {
            setError("Task title is required");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const res = await api.post(
                `/work-logs/${workLogId}/add-task`,
                {
                    data: {
                        task_title: taskTitle,
                    },
                }
            );

            const updatedTasks = res.data.tasks || [];
            const newlyAddedTask =
                updatedTasks.length > 0
                    ? updatedTasks[updatedTasks.length - 1]
                    : null;

            if (onTaskAdded && newlyAddedTask) {
                onTaskAdded(newlyAddedTask);
            }

            setTaskTitle("");
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to add task"
            );
        } finally {
            setLoading(false);
        }
    };


    return (
        <div style={styles.wrapper}>
            <input
                type="text"
                placeholder="Enter task"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                style={styles.input}
            />

            <button
                onClick={handleAddTask}
                disabled={loading || !workLogId}
                style={styles.button}
            >
                {loading ? "Adding..." : "Add Task"}
            </button>

            {!workLogId && (
                <p style={styles.info}>
                    ⚠️ Today’s work log not found
                </p>
            )}

            {error && <p style={styles.error}>{error}</p>}
        </div>
    );
};

export default AddTask;

/* ================= STYLES ================= */

const styles = {
    wrapper: {
        display: "flex",
        gap: "10px",
        maxWidth: "500px",

    },
    input: {
        flex: 1,
        padding: "10px",
        border: "2px solid #ccc", 
        borderRadius: "4px",        
        outline: "none",

    },
    button: {
        padding: "10px 16px",
        cursor: "pointer",
    },
    error: {
        color: "red",
        fontSize: "13px",
        marginTop: "6px",
    },
    info: {
        fontSize: "12px",
        color: "#666",
        marginTop: "6px",
    },
};
