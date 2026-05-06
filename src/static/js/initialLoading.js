// import { fileStore } from "/static/js/files.js";
import * as Y from "https://esm.sh/yjs";
import { WebsocketProvider } from "https://esm.sh/y-websocket";

import { convertorJSON, convertorFromJSON } from "./PandocLoader.js";
import { loadPandoc } from "./PandocLoader.js";
import {
    fetchInitialFiles,
    fileStore,
    mainFile,
    setMainFile,
} from "./files.js";
import { waitForEditorAPI } from "./editor.js";
import { SidebarManager } from "./sidebar.js";
// import { defineTheCollaboration } from "./editorCollab.js";

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
waitForEditorAPI()
    .then(() => {
        console.log("EditorAPI is ready!", window.editorAPI);
    })
    .catch(() => {
        console.warn("Some Error with the EditorAPI");
    });

// ─── Execute and load the editor content on success ────────────────────────

export let ydoc = new Y.Doc();
export let roomName = window.projectId;
export let wsURL = "/ws/collab/" + roomName + "/";
export let wsProvider = new WebsocketProvider(wsURL, "", ydoc);
// export let yFiles = ydoc.getMap("files");
window.ydoc = ydoc;
let mainFileResolve;
const mainFileReady = new Promise((res) => (mainFileResolve = res));

let PreviousText;
fetch(`/api/getMainFile/${window.projectId}`)
    .then((response) => response.json())
    .then((data) => {
        console.log("Got main file as", data.main_file);
        setMainFile(data.main_file);
        wsProvider.on("sync", () => {
            console.log("PreConfiguring On Sync Operations");
            onSync();
        });
    })
    .catch((error) => console.error("Error fetching main file:", error));

async function onSync() {
    console.log("Configuring On Sync Operations");
    for (let [filename, content] of ydoc.share) {
        if (!filename) continue;
        console.log("Configuring", filename);
        content = ydoc.getText(filename);
        fileStore[filename] = content.toString() ? content.toString() : "DUmo";
        content.observe((event) => {
            const latest = content.toString();
            console.log("Got new update with", latest.toString());
            // update your local state / UI with `latest`
            fileStore[filename] = latest.toString();

            convertorFromJSON(latest)
                .then((convertedText) => {
                    console.log("Loading value into editor", convertedText);
                    window.editorAPI.loadValue(convertedText);
                })
                .catch((err) => {
                    console.error("Conversion failed:", err);
                });
            // console.log("Loading value into editor", convertedText);

            // await waitForEditorAPI();
            // window.editorAPI.loadValue(convertedText);
        });
    }

    let mainText = fileStore[mainFile]
        ? fileStore[mainFile]
        : '{"pandoc-api-version": [1, 23, 1, 1],"meta": {},"blocks": [{"t": "Header","c": [1, ["", [], []], [{ "t": "Str", "c": "Hello" }]]}]}';

    let convertedText = await convertorFromJSON();
    PreviousText = fileStore[mainFile];
    window.editorAPI.loadValue(convertedText);
}

// await waitForEditorAPI();

// fetchInitialFiles()
//     .then(() => {
//         // If Success: load the content of the main file into the editor
//         window.editorAPI.loadValue(fileStore[mainFile]);
//         console.log("Loaded value into editor", fileStore[mainFile]);
//         console.log("Got server's Filestore", fileStore);
//     })
//     .catch((error) => {
//         console.warn("Initialisation failed, editor not loaded", error);
//     });
//
