import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
} from "https://esm.sh/react@19.0.0";
import { createRoot } from "https://esm.sh/react-dom@19.0.0/client";
import { createPortal } from "https://esm.sh/react-dom@19.0.0";
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

// ── Prism language mapping ────────────────────────────────────────────────────
const PRISM_LANG = {
    Markdown: "markdown",
    LaTeX: "latex",
    HTML: "html",
    Typst: "clike", // fallback – replace with a custom Typst grammar if available
};

// ── Helper: flatten Prism tokens into flat ranges ─────────────────────────────
function flattenTokens(tokens, start = 0) {
    const ranges = [];
    let pos = start;
    for (const token of tokens) {
        if (typeof token === "string") {
            pos += token.length;
        } else {
            const len = token.content.length;
            ranges.push({ start: pos, end: pos + len, type: token.type });
            if (Array.isArray(token.content)) {
                ranges.push(...flattenTokens(token.content, pos));
            }
            pos += len;
        }
    }
    return ranges;
}

/**
 * Create decorations for a single Slate node.
 * @param {Object} node - The Slate element node (e.g. { type: 'paragraph', children: [...] })
 * @param {number[]} path - Path of the node in the document
 * @param {string} prismLang - The Prism language string
 * @returns {Array} decorations array
 */
function makeNodeDecorations(node, path, prismLang) {
    // Concatenate all leaf texts into one string
    const blockText = node.children.map((leaf) => leaf.text).join("");
    // Tokenize with Prism (must be loaded globally)
    const tokens = Prism.tokenize(blockText, Prism.languages[prismLang]);
    const ranges = flattenTokens(tokens);
    if (ranges.length === 0) return [];

    // Build leaf start offsets within this node
    let leafStart = 0;
    const leafOffsets = node.children.map((leaf) => {
        const offset = leafStart;
        leafStart += leaf.text.length;
        return offset;
    });

    const decorations = [];

    // For each Prism range, find the leaf(s) it belongs to and create decorations
    for (const { start, end, type } of ranges) {
        let rangeStart = start;
        let rangeEnd = end;
        let currentLeaf = 0;

        while (currentLeaf < node.children.length && rangeStart < rangeEnd) {
            const leafStartOffset = leafOffsets[currentLeaf];
            const leafEndOffset =
                leafStartOffset + node.children[currentLeaf].text.length;

            if (rangeStart < leafEndOffset) {
                const anchorOffset = Math.max(rangeStart - leafStartOffset, 0);
                const focusOffset =
                    Math.min(rangeEnd, leafEndOffset) - leafStartOffset;

                if (focusOffset > anchorOffset) {
                    decorations.push({
                        anchor: {
                            path: [...path, currentLeaf],
                            offset: anchorOffset,
                        },
                        focus: {
                            path: [...path, currentLeaf],
                            offset: focusOffset,
                        },
                        prismType: type, // used by Leaf component
                    });
                }
                rangeStart = leafEndOffset;
            }
            currentLeaf++;
        }
    }

    return decorations;
}

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
    if (leaf.prismType) {
        el = React.createElement(
            "span",
            {
                className: `token ${leaf.prismType}`,
                ...attributes,
            },
            el,
        );
    }
    if (leaf.bold) el = React.createElement("strong", null, el);
    if (leaf.italic) el = React.createElement("em", null, el);
    return React.createElement("span", attributes, el);
};

// ── Initial value ─────────────────────────────────────────────────────────────

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

// ── Shared Context ────────────────────────────────────────────────────────────

const EditorContext = React.createContext(null);

function EditorProvider({ children }) {
    const [editor] = useState(() => withReact(createEditor()));
    const [mode, setMode] = useState("Typst");
    const [lineCount, setLineCount] = useState(1);
    const [, tick] = useState(0);
    const bump = () => tick((n) => n + 1);

    const headingLevel = useRef(0);
    const mathState = useRef(0);
    const codeState = useRef(0);
    const gutterRef = useRef(null);

    // Debounced save and outliner (created once)
    const debouncedSave = useRef(
        debounce((text) => SaveToServer(text), 5000),
    ).current;
    const debouncedOutliner = useRef(debounce(() => outliner(), 300)).current;

    useEffect(() => {
        window.editorAPI.getValue = () => getValue(editor);
        window.editorAPI.loadValue = (text) => loadValue(editor, text);
        window.editorAPI.setMode = (m) => setMode(m);
    }, [editor]);

    // ➔ Fixed decorate: works per node, using the node’s path
    const decorate = useCallback(
        ([node, path]) => {
            // Only decorate block-level nodes that have children (text nodes are leaf-level)
            if (!node.children) return [];
            const prismLang = PRISM_LANG[mode] || "markdown";
            return makeNodeDecorations(node, path, prismLang);
        },
        [mode],
    );

    function doFormat(key) {
        const markers = resolve(mode, key);
        if (!markers) return;
        insertWrapped(editor, markers[0], markers[1]);
    }

    function doHeading() {
        headingLevel.current = (headingLevel.current + 1) % 4;
        bump();
        const markers = resolve(mode, "heading", headingLevel.current);
        if (!markers) return;
        insertWrapped(editor, markers[0], markers[1]);
    }

    function doCycle(stateRef, cycle) {
        stateRef.current = (stateRef.current + 1) % cycle.length;
        const key = cycle[stateRef.current];
        bump();
        if (!key) return;
        const markers = resolve(mode, key);
        if (!markers) return;
        insertWrapped(editor, markers[0], markers[1]);
    }

    const handleKeyUp = useCallback(
        (event) => {
            const text = getValue(editor);
            if (window.debouncedHandler) {
                window.debouncedHandler(text);
            }
            debouncedOutliner();
            debouncedSave(text);
        },
        [editor, debouncedSave, debouncedOutliner],
    );

    return React.createElement(
        EditorContext.Provider,
        {
            value: {
                editor,
                mode,
                lineCount,
                setLineCount,
                headingLevel,
                mathState,
                codeState,
                gutterRef,
                doFormat,
                doHeading,
                doCycle,
                bump,
                handleKeyUp,
                decorate, // ← exposed to EditorPane
            },
        },
        children,
    );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export const ToolbarPane = () => {
    const { headingLevel, mathState, codeState, doFormat, doHeading, doCycle } =
        React.useContext(EditorContext);

    const btn = (label, onMD, style = {}) =>
        React.createElement(
            "button",
            {
                className: "toolbar_button ma1 pa2 br2",
                onMouseDown: (e) => {
                    e.preventDefault();
                    onMD();
                },
                style,
            },
            label,
        );

    const headingLabel =
        headingLevel.current === 0
            ? "H1"
            : headingLevel.current === 3
              ? "H↺"
              : `H${headingLevel.current + 1}`;

    return React.createElement(
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
    );
};

// ── Editor Pane ───────────────────────────────────────────────────────────────

export const EditorPane = () => {
    const {
        editor,
        lineCount,
        setLineCount,
        gutterRef,
        handleKeyUp,
        decorate, // ← taken from context
    } = React.useContext(EditorContext);

    const lineNumbers = Array.from({ length: lineCount }, (_, i) =>
        React.createElement(
            "div",
            {
                key: i,
                style: {
                    lineHeight: "1.5em",
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

    const editableWrapperRef = useRef(null);

    const handleScroll = useCallback(() => {
        if (gutterRef.current && editableWrapperRef.current) {
            gutterRef.current.scrollTop = editableWrapperRef.current.scrollTop;
        }
    }, [gutterRef]);

    return React.createElement(
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
        // Gutter
        React.createElement(
            "div",
            {
                ref: gutterRef,
                style: {
                    minWidth: "40px",
                    padding: "8px 0",
                    background: "#f5f5f5",
                    borderRight: "1px solid #ddd",
                    overflowY: "hidden",
                    flexShrink: 0,
                },
            },
            lineNumbers,
        ),
        // Scrollable wrapper
        React.createElement(
            "div",
            {
                ref: editableWrapperRef,
                onScroll: handleScroll,
                style: {
                    flex: 1,
                    overflowY: "auto",
                    height: "100%",
                },
            },
            React.createElement(
                Slate,
                {
                    editor,
                    initialValue,
                    onChange: () => setLineCount(editor.children.length),
                },
                React.createElement(Editable, {
                    style: {
                        padding: "8px",
                        lineHeight: "1.5em",
                        minHeight: "100%",
                        outline: "none",
                        boxSizing: "border-box",
                    },
                    renderLeaf: (props) => React.createElement(Leaf, props),
                    onKeyUp: handleKeyUp,
                    decorate: decorate, // ← the missing piece!
                }),
            ),
        ),
    );
};

// ── Root: single provider, portal for toolbar ─────────────────────────────────

export function RenderEditor() {
    const editorDiv = document.getElementById("editor-root");
    const buttonsDiv = document.getElementById("editor_buttons_root");

    if (!editorDiv) console.warn("No #editor_root div found.");
    if (!buttonsDiv) console.warn("No #editor_buttons_root div found.");

    const App = () =>
        React.createElement(
            EditorProvider,
            null,
            React.createElement(EditorPane),
            buttonsDiv &&
                createPortal(React.createElement(ToolbarPane), buttonsDiv),
        );

    createRoot(editorDiv).render(React.createElement(App));
}

window.editorAPI.RenderEditor = RenderEditor;

RenderEditor();

export const waitForEditorAPI = Promise.resolve(window.editorAPI);
