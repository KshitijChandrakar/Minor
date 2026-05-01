import {
    fileStore,
    activeFile,
    mainFile,
    putFile,
    renderSidebar,
    switchToFile,
} from "./files.js";

import { debounce } from "./HelperFunctions.js";

function extractInlineText(inlines) {
    let text = "";

    for (const inline of inlines) {
        switch (inline.t) {
            case "Str":
                text += inline.c;
                break;
            case "Space":
                text += " ";
                break;
            case "Emph":
            case "Strong":
                text += extractInlineText(inline.c);
                break;
            case "Code":
                text += inline.c[1];
                break;
            case "SoftBreak":
                text += " ";
                break;
            case "LineBreak":
                text += "\n";
                break;
        }
    }

    return text;
}

function extractAllHeaders(pandocJson) {
    const headers = [];

    if (pandocJson.blocks) {
        for (const block of pandocJson.blocks) {
            if (block.t === "Header") {
                const level = block.c[0];
                const content = extractInlineText(block.c[2]).slice(0, 40);
                headers.push([level, content]);
            }
        }
    }

    return headers;
}

function buildOutline(data) {
    const container = document.createElement("div");
    container.className = "outline-container";
    const stack = [{ level: 0, parent: container }];

    for (const [level, content] of data) {
        while (stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        const parent = stack[stack.length - 1].parent;
        const details = document.createElement("details");
        details.className = `outline-item level-${level}`;
        details.open = true;

        const summary = document.createElement("summary");
        summary.className = "outline-summary";

        const arrow = document.createElement("span");
        arrow.className = "outline-arrow";
        arrow.textContent = "▶";

        const text = document.createElement("span");
        text.className = "outline-text";
        text.textContent = content;

        summary.appendChild(arrow);
        summary.appendChild(text);
        details.appendChild(summary);

        const contentDiv = document.createElement("div");
        contentDiv.className = "outline-content";
        details.appendChild(contentDiv);

        parent.appendChild(details);
        stack.push({ level, parent: contentDiv });
    }
    return container;
}

async function outliner() {
    let a = JSON.parse(
        await (
            await window.pandocModule.convert(
                {
                    from: window.formatMap[window.currentState],
                    to: "json",
                    "output-file": "output.txt",
                },
                window.editorAPI.getValue(),
            )
        ).files["output.txt"].text(),
    );

    const sidebar = document.getElementById("outline-sidebar-content");
    let b = extractAllHeaders(a);
    sidebar.innerHTML = "";
    sidebar.appendChild(buildOutline(b));

    return b;
}

window.outliner = outliner;

export { outliner };
