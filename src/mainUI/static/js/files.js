// ─── File Store ──────────────────────────────────────────────────────────────
// Central source of truth for all open files.
// { filename: string → content: string }

export const fileStore = {
    "main.typ": "Hello, Try typing in the textbox to the right to render.",
};

export let activeFile = "main.typ";
export let mainFile = "main.typ";

export function setActiveFile(name) {
    activeFile = name;
}

export function setMainFile(name) {
    mainFile = name;
    renderSidebar();
}

// Add or overwrite a file
export function putFile(name, content) {
    fileStore[name] = content;
    renderSidebar();
}

// Rename a file (preserves content, updates activeFile / mainFile if needed)
export function renameFile(oldName, newName) {
    if (!newName || newName === oldName || fileStore[newName] !== undefined)
        return;
    fileStore[newName] = fileStore[oldName];
    delete fileStore[oldName];
    if (activeFile === oldName) activeFile = newName;
    if (mainFile === oldName) mainFile = newName;
    renderSidebar();
}

// Delete a file (guards against deleting the last file)
export function deleteFile(name) {
    const keys = Object.keys(fileStore);
    if (keys.length <= 1) return; // always keep at least one file
    delete fileStore[name];
    if (activeFile === name) activeFile = Object.keys(fileStore)[0];
    if (mainFile === name) mainFile = Object.keys(fileStore)[0];
    renderSidebar();
}

// ─── Files Context Bar ───────────────────────────────────────────────────────────
function showContextMenu(e, name) {
    e.preventDefault();

    // Remove existing context menu if any
    const existingMenu = document.querySelector(".custom-context-menu");
    if (existingMenu) {
        existingMenu.remove();
    }

    // Create context menu
    const menu = document.createElement("div");
    menu.className = "custom-context-menu";
    menu.style.position = "fixed";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.backgroundColor = "white";
    menu.style.border = "1px solid #ddd";
    menu.style.borderRadius = "4px";
    menu.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";
    menu.style.zIndex = "1000";
    menu.style.minWidth = "150px";

    // Menu options
    const options = [
        {
            label: "Rename",
            action: () => {
                const newname = prompt("rename to:", name);
                if (!newname) return;
                const safename = newname.includes(".")
                    ? newname
                    : newname + ".typ";
                renameFile(name, safename);
                if (window.onActiveFileChange)
                    window.onActiveFileChange(activeFile);
            },
        },
        {
            label: "Delete",
            action: () => {
                if (!confirm(`delete "${name}"?`)) return;
                deleteFile(name);
                if (window.onActiveFileChange)
                    window.onActiveFileChange(activeFile);
            },
        },
        {
            label: "Mark as Main",
            action: () => {
                if (name !== mainFile) {
                    setMainFile(name);
                    if (window.onMainFileChange) window.onMainFileChange(name);
                }
            },
        },
    ];

    options.forEach((option) => {
        const menuItem = document.createElement("div");
        menuItem.textContent = option.label;
        menuItem.style.padding = "8px 12px";
        menuItem.style.cursor = "pointer";
        menuItem.style.fontSize = "14px";

        menuItem.addEventListener("mouseenter", () => {
            menuItem.style.backgroundColor = "#f5f5f5";
        });

        menuItem.addEventListener("mouseleave", () => {
            menuItem.style.backgroundColor = "white";
        });

        menuItem.addEventListener("click", () => {
            option.action();
            menu.remove();
        });

        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // Close menu when clicking elsewhere
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeMenu);
            document.removeEventListener("contextmenu", closeMenu);
        }
    };

    setTimeout(() => {
        document.addEventListener("click", closeMenu);
        document.addEventListener("contextmenu", closeMenu);
    }, 0);
}

// ─── File Info Bar ───────────────────────────────────────────────────────────
// Updates #file-info with the current editing / main file context.

export function renderFileInfo() {
    const bar = document.getElementById("file-info");
    if (!bar) {
        console.log("the Bar is in Hell");
        return;
    }
    console.log("Active File is ", activeFile);

    // Show only the current file being edited
    bar.innerHTML = `<strong>${activeFile}</strong>`;
}

//───────────────────────────────────────────────────────────

// ─── Sidebar UI ──────────────────────────────────────────────────────────────
// Expects a <div id="sidebar">
// Calls window.onActiveFileChange(name) whenever the editor should switch files.
export function renderSidebar() {
    const sidebar = document.getElementById("files-sidebar");
    if (!sidebar) return;

    // Clear existing content except the static HTML structure
    const header = sidebar.querySelector(".sidebar-header");
    const list = sidebar.querySelector(".sidebar-list");
    const newBtn = header.querySelector(".sidebar-new-btn");

    const newBtnClone = newBtn.cloneNode(true);
    newBtn.parentNode.replaceChild(newBtnClone, newBtn);
    newBtnClone.addEventListener("click", () => {
        const name = prompt("New file name:");
        if (!name) return;
        console.log(`Pressed Button ${name}`);
        const safeName = name.includes(".") ? name : name + ".typ";
        putFile(safeName, "");
        switchToFile(safeName);
    });

    // Clear and rebuild file list
    list.innerHTML = "";

    Object.keys(fileStore).forEach((name) => {
        const li = document.createElement("li");
        li.className =
            "sidebar-item" +
            (name === activeFile ? " sidebar-item--active" : "") +
            (name === mainFile ? " sidebar-item--main" : "");

        // File name (click to open)
        const nameSpan = document.createElement("span");
        nameSpan.className = "sidebar-item-name inactive-file";
        nameSpan.textContent = name + (name === mainFile ? " ★" : "");
        nameSpan.title = "Click to open";
        nameSpan.addEventListener("click", () => switchToFile(name));
        nameSpan.fileName = name;

        nameSpan.addEventListener("contextmenu", (e) => {
            console.log("context menu");
            showContextMenu(e, name);
        });
        li.appendChild(nameSpan);
        list.appendChild(li);
    });

    renderFileInfo();
}
export function switchToFile(name) {
    // Save current textarea → fileStore before switching
    if (window.editorAPI.getValue)
        fileStore[activeFile] = window.editorAPI.getValue();

    const list = sidebar.querySelector(".sidebar-list");
    list.querySelectorAll(".active-file").forEach((element) => {
        element.classList.remove("active-file");
        element.classList.add("inactive-file");
    });
    const newActiveFile = Array.from(list.querySelectorAll(".file")).filter(
        (element) => element.fileName === name,
    );
    newActiveFile.forEach((el) => {
        element.classList.add("active-file");
        element.classList.remove("inactive-file");
    });
    activeFile = name;
    renderSidebar(); // renderSidebar calls renderFileInfo internally
    renderFileInfo();

    if (window.onActiveFileChange) window.onActiveFileChange(name);
}
