import {
    fileStore,
    activeFile,
    mainFile,
    putFile,
    renderSidebar,
    switchToFile,
} from "./files.js";
import { currentState } from "./buttons.js";
import { RenderError } from "./errors.js";
// ─── DOM refs ────────────────────────────────────────────────────────────────
// const stateDisplay = document.getElementById("state-display");
const inputhide = document.getElementById("text-input-hidden");
const input = document.getElementById("text-input");
const contentDiv = document.getElementById("content");

// ─── Pandoc loading ──────────────────────────────────────────────────────────
let pandocReadyPromise = null;
export let onFormatsLoaded = null;

function loadPandoc() {
    if (pandocReadyPromise) return pandocReadyPromise;

    pandocReadyPromise = (async () => {
        const { createPandocInstance } = await import("./core.js");
        const response = await fetch("./static/js/pandoc.wasm");
        const wasmBinary = await response.arrayBuffer();
        const { convert, query } = await createPandocInstance(wasmBinary);
        window.pandocModule = { convert, query };

        const pandocVersion = await query({ query: "version" });
        const inputFormats = await query({ query: "input-formats" });
        const outputFormats = await query({ query: "output-formats" });

        if (onFormatsLoaded) onFormatsLoaded(inputFormats, outputFormats);
    })();

    console.log("loaded Pandoc");
    return pandocReadyPromise;
}

loadPandoc().catch((err) => console.error("Failed to load pandoc:", err));

// ─── Typst loading ───────────────────────────────────────────────────────────
let typstLoaded = false;
let typstLoadingPromise = null;

window.loadTypst = async function () {
    if (typstLoaded && typeof $typst !== "undefined") return;
    if (typstLoadingPromise) return typstLoadingPromise;

    typstLoadingPromise = new Promise((resolve, reject) => {
        const typstScript = document.createElement("script");
        typstScript.type = "module";
        typstScript.src = "/static/js/typst.js";
        // "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-all-in-one.ts@0.7.0-rc2/dist/esm/index.js";
        typstScript.id = "typst";
        typstScript.onload = () => {
            const checkTypst = () => {
                if (typeof $typst !== "undefined") {
                    typstLoaded = true;
                    resolve();
                } else {
                    setTimeout(checkTypst, 100);
                }
            };
            checkTypst();
        };
        typstScript.onerror = () => reject(new Error("Failed to load Typst"));
        document.head.appendChild(typstScript);
    });

    return typstLoadingPromise;
};

loadTypst()
    .then(() => {
        console.log("Loaded Typst");
        previewSvg(fileStore[mainFile] ?? "");
    })
    .catch((err) => {
        console.error("Failed to load Typst:", err);
    });

// ─── Preview ─────────────────────────────────────────────────────────────────
let lastContent = null;

// Sync every file in fileStore into Typst's virtual filesystem so that
// #import "other.typ" works without hitting the sandbox access-denied error.
// Files are mounted at /playground/<filename> and the main file is passed
// as mainContent using the same path so imports resolve correctly.
function syncFilesToTypst() {
    for (const [name, content] of Object.entries(fileStore)) {
        // mapShadow overlays a file into Typst's in-memory FS at the given path.
        // Use addSource for .typ files (parsed as Typst source),
        // and mapShadow for everything else (treated as raw bytes).
        const path = `/${name}`;
        if (name.endsWith(".typ")) {
            $typst.addSource(path, content ?? "");
        } else {
            const bytes = new TextEncoder().encode(content ?? "");
            $typst.mapShadow(path, bytes);
        }
    }
}

export let firstRendered = false;
export const previewSvg = (mainContent) => {
    if (mainContent === lastContent) return;
    if (!mainContent || !mainContent.trim()) {
        contentDiv.innerHTML = "";
        lastContent = mainContent;
        return;
    }
    lastContent = mainContent;
    console.log("Loading render with", mainContent);
    syncFilesToTypst();
    console.time("Typst Render");

    $typst
        .svg({ mainContent })
        .then((svg) => {
            hideLoadingScreen();
            console.timeEnd("Typst Render");
            console.log(`Rendered svgelement { len: ${svg.length} }`);
            contentDiv.innerHTML = svg;
            const svgElem = contentDiv.firstElementChild;
            svgElem.style.border = "2px solid black";
            // contentDiv.style.height = "500px";
        })
        .catch((err) => {
            console.timeEnd("Typst Render");
            console.error("Compilation Error:", err);
            RenderError(err);
            errr = err;
        });
    console.log("Done?");
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// All files except the entry point are passed as the `files` payload so pandoc
// can resolve cross-file references (includes, imports, etc.)
function buildFilesPayload(entryName) {
    const files = {};
    for (const [name, content] of Object.entries(fileStore)) {
        if (name !== entryName) files[name] = content;
    }
    return files;
}

// ─── Unified debounced input handler ─────────────────────────────────────────
const debouncedHandler = debounce(async (value) => {
    // Keep fileStore in sync with the textarea
    fileStore[activeFile] = value;

    // const currentFormat = stateDisplay.textContent;
    const currentFormat = currentState;

    if (currentFormat === "Typst") {
        // Always preview the main file; if the user is editing a non-main file
        // we still want to re-render since it may be imported by main.
        const mainContent =
            activeFile === mainFile ? value : fileStore[mainFile];
        previewSvg(mainContent ?? "");
        return;
    }

    // Pandoc path: convert mainFile content → typst for live preview
    const fromFormat = formatMap[currentFormat];
    if (!fromFormat || !window.pandocModule) return;

    const entryContent = fileStore[mainFile] ?? "";
    const filesPayload = buildFilesPayload(mainFile);

    try {
        const compile_result = await window.pandocModule.convert(
            {
                from: fromFormat,
                to: "typst",
                "output-file": "output.txt",
                "resource-path": ["."],
            },
            entryContent,
            filesPayload,
        );

        if (compile_result.files?.["output.txt"]) {
            previewSvg(await compile_result.files["output.txt"].text());
        }
    } catch (error) {
        console.error("Conversion failed:", error);
    }
}, 1000);

input.addEventListener("input", (e) => {
    debouncedHandler(e.target.value);
});

// ─── File switching wiring ────────────────────────────────────────────────────
// files.js calls these when the active or main file changes.

window.onActiveFileChange = (name) => {
    input.value = fileStore[name] ?? "";
    debouncedHandler(input.value);
};

window.onMainFileChange = () => {
    // Re-render using the newly designated main file
    debouncedHandler(input.value);
};

// ─── Init ─────────────────────────────────────────────────────────────────────
input.value = fileStore[activeFile] ?? "";
renderSidebar();
