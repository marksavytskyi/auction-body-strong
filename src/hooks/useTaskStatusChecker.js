import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axios";

const useTaskStatusChecker = (initialTasks, interval = 60000) => {
    const [taskList, setTaskList] = useState(initialTasks); // Store task list state

    useEffect(() => {
        let intervalId;

        const checkTaskStatuses = async () => {
            try {
                const pendingTasks = taskList.filter((task) => task.status === "PENDING");
                console.log("initialTasks", initialTasks)
                console.log("taskList", taskList)
                // Create a list of promises for all pending tasks
                const taskPromises = pendingTasks.map((task) =>
                    axiosInstance
                        .get("/celery/get-task-status", { params: { taskId: task.taskId } })
                        .then((response) => ({
                            taskId: task.taskId,
                            status: response?.data?.state,
                            result: response?.data?.result,
                        }))
                        .catch((error) => {
                            console.error(`Error checking status for task ${task.taskId}:`, error);
                            return { taskId: task.taskId, status: task.status, error };
                        })
                );
                // Wait for all requests to complete
                const results = await Promise.all(taskPromises);

                // Update the task list with the results
                const updatedTasks = taskList.map((task) => {
                    const result = results.find((res) => res.taskId === task.taskId);

                    if (result && result.status === "SUCCESS" && !task.data) {
                        return { ...task, status: "SUCCESS", data: result.result }; // Update task status and data
                    }
                    return task; // Keep the task as is if no update is needed
                });

                setTaskList(updatedTasks); // Update the state with the updated tasks
            } catch (error) {
                console.error("Error during task status checks:", error);
            }
        };

        // Start polling every interval
        intervalId = setInterval(() => {
            checkTaskStatuses();
        }, interval);

        // Clean up interval on unmount
        return () => clearInterval(intervalId);
    }, [initialTasks, interval]);

    return taskList; // Return the updated task list
};

export default useTaskStatusChecker;