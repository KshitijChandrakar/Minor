import { debounce } from "./HelperFunctions.js";
import { filesChanged, activeFile, fileStore } from "./files.js";

export async function SaveToServer(s) {
    // Check if the active file has been changed
    if (filesChanged[activeFile] != true) return;

    // Get the content from fileStore if the file hasn't been changed
    const fileContent = fileStore[activeFile];
    let projectId = window.projectId;

    // If you want to only send the active file that has changed:
    const activeFilePayload = {
        [projectId]: [
            {
                filename: activeFile,
                newContent: fileContent,
            },
        ],
    };
    try {
        const response = await fetch("/api/filesChange", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(activeFilePayload), // or payload for multiple files
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Success:", result);

        return result;
    } catch (error) {
        console.error("Error saving to server:", error);
    }
}
