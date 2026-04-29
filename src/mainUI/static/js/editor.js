import React, {
    useState,
    useRef,
    useEffect,
} from "https://esm.sh/react@19.0.0";
import { createRoot } from "https://esm.sh/react-dom@19.0.0/client";
import { createEditor, Transforms, Editor, Range } from "https://esm.sh/slate";
import {
    Slate,
    Editable,
    withReact,
} from "https://esm.sh/slate-react?deps=react@19.0.0,react-dom@19.0.0";
import { outliner } from "./outline.js";

import { debounce } from "./HelperFunctions.js";

import { SaveToServer } from "./UploadSave.js";

window.editorAPI = {};
// ── Syntax table ──────────────────────────────────────────────────────────────

const SYNTAX = {
    Markdown: {
        bold: ["**", "**"],
        italic: ["_", "_"],
        heading: (l) => (l === 0 ? null : ["#".repeat(l) + " ", ""]),
        mathInline: ["$", "$"],
        mathBlock: ["\n$$\n", "\n$$\n"],
        codeInline: ["`", "`"],
        codeBlock: ["\n```\n", "\n```\n"],
    },
    Typst: {
        bold: ["*", "*"],
        italic: ["_", "_"],
        heading: (l) => (l === 0 ? null : ["=".repeat(l) + " ", ""]),
        mathInline: ["$", "$"],
        mathBlock: ["$ ", " $"],
        codeInline: ["`", "`"],
        codeBlock: ["```\n", "\n```"],
    },
    LaTeX: {
        bold: ["\\textbf{", "}"],
        italic: ["\\textit{", "}"],
        heading: (l) => {
            if (l === 0) return null;
            return [
                ["\\section{", "\\subsection{", "\\subsubsection{"][l - 1],
                "}",
            ];
        },
        mathInline: ["\\(", "\\)"],
        mathBlock: ["\n\\[\n", "\n\\]\n"],
        codeInline: ["\\texttt{", "}"],
        codeBlock: ["\n\\begin{verbatim}\n", "\n\\end{verbatim}\n"],
    },
    HTML: {
        bold: ["<b>", "</b>"],
        italic: ["<i>", "</i>"],
        heading: (l) => (l === 0 ? null : [`<h${l}>`, `</h${l}>`]),
        mathInline: ["$", "$"],
        mathBlock: ["\n$$\n", "\n$$\n"],
        codeInline: ["<code>", "</code>"],
        codeBlock: ["<pre><code>\n", "\n</code></pre>"],
    },
};

function resolve(mode, key, ...args) {
    const entry = (SYNTAX[mode] || SYNTAX.Markdown)[key];
    return typeof entry === "function" ? entry(...args) : entry;
}

// ── Slate helpers ─────────────────────────────────────────────────────────────

function insertWrapped(editor, open, close) {
    const { selection } = editor;
    const hasSelection = selection && !Range.isCollapsed(selection);
    if (hasSelection) {
        const selectedText = Editor.string(editor, selection);
        const start = Range.start(selection);
        Transforms.insertText(editor, `${open}${selectedText}${close}`, {
            at: selection,
        });
        const innerStart = {
            path: start.path,
            offset: start.offset + open.length,
        };
        const innerEnd = {
            path: start.path,
            offset: start.offset + open.length + selectedText.length,
        };
        Transforms.select(editor, {
            anchor: innerStart,
            focus: innerEnd,
        });
    } else {
        Transforms.insertText(editor, `${open}${close}`);
        Transforms.move(editor, {
            distance: close.length,
            unit: "character",
            reverse: true,
        });
    }
}

// ── getValue / loadValue ──────────────────────────────────────────────────────

export function getValue(editor) {
    return editor.children
        .map((node) => node.children.map((leaf) => leaf.text).join(""))
        .join("\n");
}

export function loadValue(editor, text) {
    const newNodes = text.split("\n").map((line) => ({
        type: "paragraph",
        children: [{ text: line }],
    }));
    Editor.withoutNormalizing(editor, () => {
        while (editor.children.length > 0) {
            Transforms.removeNodes(editor, { at: [0] });
        }
        Transforms.insertNodes(editor, newNodes, { at: [0] });
    });
}

// ── Cycle config ──────────────────────────────────────────────────────────────

const MATH_CYCLE = [null, "mathInline", "mathBlock"];
const CODE_CYCLE = [null, "codeInline", "codeBlock"];
const MATH_LABELS = ["M", "M·$", "M·$$"];
const CODE_LABELS = ["<>", "<>`", "<>```"];

// ── Leaf ──────────────────────────────────────────────────────────────────────

const Leaf = ({ attributes, children, leaf }) => {
    let el = children;
    if (leaf.bold) el = React.createElement("strong", null, el);
    if (leaf.italic) el = React.createElement("em", null, el);
    return React.createElement("span", attributes, el);
};

// ── App ───────────────────────────────────────────────────────────────────────

const MODES = ["Markdown", "Typst", "LaTeX", "HTML"];

const initialValue = [
    {
        type: "paragraph",
        children: [
            {
                text: "Select text and use the toolbar, or place cursor to insert markers.",
            },
        ],
    },
];

export const App = () => {
    const [editor] = useState(() => withReact(createEditor()));
    const [mode, setMode] = useState("Typst");
    window.editorAPI["setMode"] = setMode;

    const [lineCount, setLineCount] = useState(1);
    const [, tick] = useState(0);
    const bump = () => tick((n) => n + 1);

    const headingLevel = useRef(0);
    const mathState = useRef(0);
    const codeState = useRef(0);
    const gutterRef = useRef(null);
    const editorRef = useRef(null);

    // Sync gutter scroll with editor scroll
    const syncScroll = () => {
        if (gutterRef.current && editorRef.current) {
            gutterRef.current.scrollTop = editorRef.current.scrollTop;
        }
    };

    // Count lines from editor value
    const updateLineCount = (editorInstance) => {
        const content = editorInstance.children
            .map((node) => Node.string(node))
            .join("\n");
        const lines = content.split("\n").length;
        setLineCount(Math.max(lines, editorInstance.children.length));
    };

    useEffect(() => {
        window.editorAPI["getValue"] = () => getValue(editor);
        window.editorAPI["loadValue"] = (text) => loadValue(editor, text);
    }, [editor]);

    function doFormat(key) {
        const markers = resolve(mode, key);
        if (!markers) return;
        insertWrapped(editor, markers[0], markers[1]);
    }

    function doHeading() {
        headingLevel.current = (headingLevel.current % 3) + 1;
        const markers = resolve(mode, "heading", headingLevel.current);
        if (!markers) return;
        insertWrapped(editor, markers[0], markers[1]);
        bump();
    }

    function doCycle(stateRef, cycle) {
        stateRef.current = (stateRef.current + 1) % cycle.length;
        const key = cycle[stateRef.current];
        if (!key) {
            bump();
            return;
        }
        const markers = resolve(mode, key);
        if (!markers) {
            bump();
            return;
        }
        insertWrapped(editor, markers[0], markers[1]);
        bump();
    }

    const btn = (label, onMD, style = {}) =>
        React.createElement(
            "button",
            {
                onMouseDown: (e) => {
                    e.preventDefault();
                    onMD();
                },
                style,
            },
            label,
        );

    const headingLabel = `H${headingLevel.current === 3 ? "↺" : headingLevel.current + 1}`;

    // Build line number elements
    const lineNumbers = Array.from({ length: lineCount }, (_, i) =>
        React.createElement(
            "div",
            {
                key: i,
                style: {
                    lineHeight: "1.5em", // must match editor line-height
                    color: "#888",
                    textAlign: "right",
                    userSelect: "none",
                    fontSize: "13px",
                    paddingRight: "8px",
                },
            },
            i + 1,
        ),
    );

    return React.createElement(
        React.Fragment,
        null,
        // Toolbar
        React.createElement(
            "div",
            { className: "toolbar" },
            btn("B", () => doFormat("bold"), { fontWeight: "bold" }),
            btn("I", () => doFormat("italic"), { fontStyle: "italic" }),
            btn(headingLabel, doHeading),
            btn(MATH_LABELS[mathState.current], () =>
                doCycle(mathState, MATH_CYCLE),
            ),
            btn(CODE_LABELS[codeState.current], () =>
                doCycle(codeState, CODE_CYCLE),
            ),
        ),

        // Editor + gutter wrapper
        React.createElement(
            "div",
            {
                style: {
                    display: "flex",
                    fontFamily: "monospace",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    height: "400px",
                    overflow: "hidden",
                },
            },

            // ── Gutter ──
            React.createElement(
                "div",
                {
                    ref: gutterRef,
                    style: {
                        minWidth: "40px",
                        padding: "8px 0",
                        background: "#f5f5f5",
                        borderRight: "1px solid #ddd",
                        overflowY: "scroll", // scrolls in sync via JS, not independently
                        flexShrink: 0,
                    },
                },
                lineNumbers,
            ),

            // ── Slate editor ──
            React.createElement(
                Slate,
                {
                    editor,
                    initialValue,
                    onChange: (value) => {
                        // Recount lines on every change
                        setLineCount(editor.children.length);
                    },
                },
                React.createElement(Editable, {
                    id: "slate-area",
                    // ref: editorRef,
                    style: {
                        flex: 1,
                        padding: "8px",
                        lineHeight: "1.5em", // keep in sync with gutter
                        overflowY: "auto",
                        minHeight: "200px",
                        height: "100%",
                        outline: "none",
                        boxSizing: "border-box",
                    },
                    renderLeaf: (props) => React.createElement(Leaf, props),
                    onScroll: syncScroll,
                    onKeyUp: (event) => {
                        console.log("Key pressed:", event.key);
                        if (window.debouncedHandler)
                            window.debouncedHandler(
                                window.editorAPI.getValue(),
                            );
                        outliner();
                        debounce(
                            SaveToServer(window.editorAPI.getValue()),
                            5000,
                        );
                    },
                    onCopy: (event) => {},
                    onPaste: (event) => {},
                    onCut: (event) => {},
                    onFocus: (event) => {},
                    onBlur: (event) => {},
                    onDragStart: (event) => {},
                    onDrop: (event) => {},
                }),
            ),
        ),
    );
};

const EditorDiv = document.getElementById("editor-root");
if (!EditorDiv) {
    console.log("UGGGhh No editor div?");
}
createRoot(EditorDiv).render(React.createElement(App));

export function RenderEditor() {
    const EditorDiv = document.getElementById("editor-root");
    if (!EditorDiv) {
        console.log("UGGGhh No editor div?");
    }
    createRoot(EditorDiv).render(React.createElement(App));
}

window.editorAPI.RenderEditor = RenderEditor;

export const waitForEditorAPI = new Promise((resolve) => {
    if (window.editorAPI) {
        resolve(window.editorAPI);
        return;
    }

    const checkInterval = setInterval(() => {
        if (window.editorAPI) {
            clearInterval(checkInterval);
            resolve(window.editorAPI);
        }
    }, 100); // Check every 100ms
});
