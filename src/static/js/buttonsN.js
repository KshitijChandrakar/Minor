import { fileStore, mainFile, activeFile, renderSidebar } from "./files.js";
import { previewSvg } from "./main.js";

const buttonOptions = ["Typst", "Markdown", "LaTeX", "HTML"];

/* format mapping */

window.formatMap = {
    Typst: "typst",

    Markdown: "markdown",

    LaTeX: "latex-autoidentifiers",

    HTML: "html",
};

window.currentState = "Typst";

/* create buttons */

const container = document.getElementById("button-container");

buttonOptions.forEach((option) => {
    const btn = document.createElement("button");

    btn.textContent = option;

    btn.className = "state-btn regularbutton";

    btn.addEventListener(
        "click",

        () => setState(option),
    );

    container.appendChild(btn);
});

/* move blue slider */

function updateButtonStyles() {
    const buttons = document.querySelectorAll(".state-btn");

    const slider = document.querySelector(
        "#button-container .button-selection",
    );

    buttons.forEach((btn, index) => {
        if (btn.textContent === window.currentState) {
            btn.classList.add("selectedbutton");

            const movePercent = index * 100;

            slider.style.transform = `translateX(${movePercent}%)`;
        } else {
            btn.classList.remove("selectedbutton");
        }
    });
}

/* switch format */

async function setState(newState) {
    const oldState = window.currentState;

    window.currentState = newState;

    window.editorAPI.setMode(newState);

    updateButtonStyles();

    const fromFormat = window.formatMap[oldState];

    const toFormat = window.formatMap[newState];

    fileStore[activeFile] = window.editorAPI.getValue();

    const fileNames = Object.keys(fileStore);

    const convertedMap = {};

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
                convertedMap[name] = fileStore[name];
            }
        } catch (err) {
            console.error(
                "conversion error",

                err,
            );

            convertedMap[name] = fileStore[name];
        }
    }

    for (const [name, content] of Object.entries(convertedMap)) {
        fileStore[name] = content;
    }

    window.editorAPI.loadValue(fileStore[activeFile] ?? "");

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
            console.error(
                "preview error",

                err,
            );
        }
    }

    renderSidebar();
}

/* initial position */

updateButtonStyles();
