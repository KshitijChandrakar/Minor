import { loadPandoc } from "./PandocLoader.js";
import { fetchInitialFiles, fileStore, mainFile } from "./files.js";
import { waitForEditorAPI } from "./editor.js";
import { SidebarManager } from "./sidebar.js";

window.projectId = window.location.pathname.match(/\/editor\/([^\/?#]+)/)?.[1];

const sidebarManager = new SidebarManager();
sidebarManager.toggleSidebar("files");
// -- Load Pandoc -----------------------
loadPandoc()
    .then(() => {
        console.log("loaded Pandoc");
    })
    .catch((err) => {
        console.error("Failed to load pandoc:", err);
    });

// -- Wait for the EditorAPI
waitForEditorAPI
    .then((editorAPI) => {
        console.log("EditorAPI is ready!", editorAPI);
    })
    .catch(() => {
        console.warn("Some Error with the EditorAPI");
    });

// ─── Execute and load the editor content on success ────────────────────────
fetchInitialFiles()
    .then(() => {
        // If Success: load the content of the main file into the editor
        while (!window.editorAPI) {
            window.editorAPI.loadValue(fileStore[mainFile]);
            console.log("Loaded value into editor", fileStore[mainFile]);
            console.log("Got server's Filestore", fileStore);
        }

    }
    .catch((error) => {
        console.warn("Initialisation failed, editor not loaded", error);
    });
