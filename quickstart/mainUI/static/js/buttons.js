import { fileStore, mainFile, activeFile, renderSidebar } from "./files.js";
import { previewSvg } from "./main.js";

const buttonOptions = ["Typst", "Markdown", "LaTeX", "HTML"];

// Exposed globally so main.js debouncedHandler can read it
window.formatMap = {
    Typst: "typst",
    Markdown: "markdown",
    LaTeX: "latex-auto_identifiers",
    HTML: "html",
};

window.currentState = "Typst";

function updateButtonStyles() {
    document.querySelectorAll(".state-btn").forEach((button) => {
        if (button.textContent === window.currentState) {
            button.classList.add("selected_button");
            const buttonGroup = document.getElementById("button-container");
            const selectedIndex = buttonOptions.indexOf(window.currentState);
            const buttons = document.querySelectorAll(".regular_button");
            if (buttonGroup && buttonOptions.length > 0) {
                const slider = buttonGroup.querySelector(".button-selection");
                if (slider) {
                    const percent =
                        (selectedIndex / buttonOptions.length) * 100;
                    slider.style.left = `${percent}%`;
                    // console.log("moved to", percent);
                }
            }
        } else {
            button.classList.remove("selected_button");
            // button.classList.add("bg-red");
        }
    });
}

const buttonContainer = document.getElementById("button-container");
buttonOptions.forEach((option) => {
    const button = document.createElement("button");
    button.textContent = option;
    button.className = "state-btn regular_button";
    button.addEventListener("click", () => setState(option));
    buttonContainer.appendChild(button);
});

updateButtonStyles();

async function setState(newState) {
    const oldState = window.currentState;
    window.currentState = newState;
    window.editorAPI.setMode(newState);
    const fromFormat = window.formatMap[oldState];
    const toFormat = window.formatMap[newState];

    updateButtonStyles();

    fileStore[activeFile] = window.editorAPI.getValue();

    // Convert every file individually from old format → new format.
    // We also keep a typst-converted copy of the main file for the preview.
    const fileNames = Object.keys(fileStore);
    const convertedMap = {}; // name → converted string

    for (const name of fileNames) {
        try {
            const result = await window.pandocModule.convert(
                {
                    from: fromFormat,
                    to: toFormat,
                    "output-file": "output.txt",
                    "resource-path": ["."],
                },
                fileStore[name],
                {},
            );

            if (result.files?.["output.txt"]) {
                convertedMap[name] = await result.files["output.txt"].text();
            } else {
                // Conversion produced no output — keep original content
                convertedMap[name] = fileStore[name];
            }
        } catch (err) {
            console.error(`Conversion failed for "${name}":`, err);
            convertedMap[name] = fileStore[name]; // fallback: keep original
        }
    }

    // Write all converted content back into fileStore
    for (const [name, content] of Object.entries(convertedMap)) {
        fileStore[name] = content;
    }

    window.editorAPI.loadValue(fileStore[activeFile] ?? "");

    // Update the preview using the main file.
    // If the new format is Typst, preview directly.
    // Otherwise convert mainFile → typst for the preview.
    if (newState === "Typst") {
        previewSvg(fileStore[mainFile] ?? "");
    } else {
        try {
            const previewResult = await window.pandocModule.convert(
                {
                    from: toFormat,
                    to: "typst",
                    "output-file": "output.txt",
                    "resource-path": ["."],
                },
                fileStore[mainFile] ?? "",
                {},
            );

            if (previewResult.files?.["output.txt"]) {
                previewSvg(await previewResult.files["output.txt"].text());
            }
        } catch (err) {
            console.error("Preview conversion failed:", err);
        }
    }

    renderSidebar();
}
document.getElementById("newDocBtn")
?.addEventListener("click", ()=>{

window.location.href =
"/Teamwork/ui-editor-module/editor.html";

});
/* =============================
   OPEN EDITOR PAGE
============================= */

document.addEventListener("DOMContentLoaded", function(){

const newDocBtn =
document.getElementById("newDocBtn");

if(newDocBtn){

newDocBtn.addEventListener("click", function(){

/*
path explanation:

src/mainUI → go up → Teamwork → ui-editor-module → editor.html
*/

window.location.href =
"../../Teamwork/ui-editor-module/editor.html";

});

}

});


