// --- Add these imports at the top of your file ---
import * as Y from "https://esm.sh/yjs@13.6.15";
import { WebsocketProvider } from "https://esm.sh/y-websocket@1.5.4";
import {
    withYjs,
    YjsEditor,
} from "https://esm.sh/slate-yjs@0.6.0?deps=slate@0.94.0,react@19.0.0,slate-react@0.99.0";
import { withHistory } from "https://esm.sh/slate-history";

// Keep your existing imports unchanged (convertor, React, etc.)
import { convertor, convertorJSON } from "./PandocLoader.js";
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
    ReactEditor,
} from "https://esm.sh/slate-react?deps=react@19.0.0,react-dom@19.0.0";
import { outliner } from "./outline.js";
import { debounce } from "./HelperFunctions.js";
import { SaveToServer } from "./UploadSave.js";
import {
    SYNTAX,
    resolve,
    MATH_CYCLE,
    CODE_CYCLE,
    MATH_LABELS,
    initialValue,
    CODE_LABELS,
    PRISM_LANG,
} from "./editorHelpers.js";

window.editorAPI = {};

// ── Helper: flatten Prism tokens (unchanged) ─────────────────────────────────
function flattenTokens(tokens, start = 0) {
    /* ... keep your existing implementation ... */
}
function makeNodeDecorations(node, path, prismLang) {
    /* ... keep yours ... */
}

// ── Slate helpers (unchanged) ────────────────────────────────────────────────
function insertWrapped(editor, open, close) {
    /* ... keep yours ... */
}
export function getValue(editor) {
    /* ... keep yours ... */
}
export function loadValue(editor, text) {
    /* ... keep yours ... */
}

// ── Leaf component (unchanged) ───────────────────────────────────────────────
const Leaf = ({ attributes, children, leaf }) => {
    /* ... keep yours ... */
};

// ── Shared Context (modified to use collaborative editor) ────────────────────
const EditorContext = React.createContext(null);

function EditorProvider({ children, docId = "default-doc" }) {
    // 1. Create Yjs document and shared type
    const ydoc = useRef(new Y.Doc()).current;
    const sharedType = ydoc.getArray("slate"); // Slate's top-level nodes

    // 2. WebSocket provider
    const wsProvider = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const url = `ws://localhost:8000/ws/collab/${docId}/`; // adapt to your Django URL
        wsProvider.current = new WebsocketProvider(url, "slate-room", ydoc);
        wsProvider.current.on("status", (event) => {
            setConnected(event.status === "connected");
        });
        return () => {
            wsProvider.current?.destroy();
            ydoc.destroy();
        };
    }, [docId, ydoc]);

    // 3. Create collaborative Slate editor
    const [editor] = useState(() => {
        const e = withYjs(createEditor(), sharedType, { autoConnect: false });
        // Re‑apply React and history plugins (yjs already handles undo/redo stack)
        const withReactAndHistory = withHistory(withReact(e));
        // But yjs already provides undo/redo; we'll use editor.undo/redo from yjs
        // We'll keep withHistory only for local undo stack (optional)
        return withReactAndHistory;
    });

    // 4. Initialize the shared document with your initialValue if empty
    useEffect(() => {
        if (sharedType.length === 0) {
            // Convert initialValue (your Slate nodes) to Yjs format
            sharedType.insert(0, initialValue);
        }
    }, [sharedType]);

    const [mode, setMode] = useState("Typst");
    const [lineCount, setLineCount] = useState(1);
    const [, tick] = useState(0);
    const bump = () => tick((n) => n + 1);

    const headingLevel = useRef(0);
    const mathState = useRef(0);
    const codeState = useRef(0);
    const gutterRef = useRef(null);

    // Debounced save and outliner – they still work directly on editor.children
    const debouncedSave = useRef(debounce(() => SaveToServer(), 5000)).current;
    const debouncedOutliner = useRef(debounce(() => outliner(), 300)).current;

    // Expose API (getValue / loadValue) – loadValue must sync with Yjs
    useEffect(() => {
        window.editorAPI.getValue = () => getValue(editor);
        window.editorAPI.loadValue = (text) => {
            // Overwrite remote doc: load text, convert to nodes
            const newNodes = text.split("\n").map((line) => ({
                type: "paragraph",
                children: [{ text: line }],
            }));
            // Yjs atomic replace
            const yNodes = sharedType.toJSON(); // get current
            sharedType.delete(0, sharedType.length);
            sharedType.insert(0, newNodes);
        };
        window.editorAPI.setMode = (m) => setMode(m);
    }, [editor, sharedType]);

    const decorate = useCallback(
        ([node, path]) => {
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
            debouncedSave();
            convertorJSON(window.editorAPI.getValue());
        },
        [editor, debouncedSave, debouncedOutliner],
    );

    // Undo/Redo from Yjs (works across clients)
    const undo = useCallback(() => YjsEditor.undo(editor), [editor]);
    const redo = useCallback(() => YjsEditor.redo(editor), [editor]);

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
                decorate,
                undo,
                redo,
                connected, // optional: show connection status
            },
        },
        children,
    );
}

// ── Toolbar (unchanged except undo/redo already work) ─────────────────────────
export const ToolbarPane = () => {
    const {
        headingLevel,
        mathState,
        codeState,
        doFormat,
        doHeading,
        doCycle,
        undo,
        redo,
        editor,
        connected,
    } = React.useContext(EditorContext);

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

    const handleUndo = useCallback(() => {
        undo();
        ReactEditor.focus(editor);
    }, [undo, editor]);

    const handleRedo = useCallback(() => {
        redo();
        ReactEditor.focus(editor);
    }, [redo, editor]);

    return React.createElement(
        "div",
        { className: "toolbar" },
        btn("↩", handleUndo),
        btn("↪", handleRedo),
        btn("B", () => doFormat("bold"), { fontWeight: "bold" }),
        btn("I", () => doFormat("italic"), { fontStyle: "italic" }),
        btn(headingLabel, doHeading),
        btn(MATH_LABELS[mathState.current], () =>
            doCycle(mathState, MATH_CYCLE),
        ),
        btn(CODE_LABELS[codeState.current], () =>
            doCycle(codeState, CODE_CYCLE),
        ),
        // Optional: connection indicator
        React.createElement(
            "span",
            { style: { marginLeft: "10px", fontSize: "12px" } },
            connected ? "🟢 Live" : "🔴 Connecting",
        ),
    );
};

// ── Editor Pane (unchanged – Slate will now be collaborative) ─────────────────
export const EditorPane = () => {
    const {
        editor,
        lineCount,
        setLineCount,
        gutterRef,
        handleKeyUp,
        decorate,
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

    const onKeyDown = useCallback(
        (event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            if (event.key === "z") {
                event.preventDefault();
                if (event.shiftKey) {
                    YjsEditor.redo(editor);
                } else {
                    YjsEditor.undo(editor);
                }
            }
        },
        [editor],
    );

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
                    initialValue: [], // will be populated by Yjs
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
                    onKeyDown: onKeyDown,
                    decorate: decorate,
                }),
            ),
        ),
    );
};

// ── Root – get docId from URL or data attribute ──────────────────────────────
export function RenderEditor() {
    const editorDiv = document.getElementById("editor-root");
    const buttonsDiv = document.getElementById("editor_buttons_root");
    // Extract docId from window.location or a meta tag
    const docId = window.location.pathname.split("/").pop() || "default-doc";

    if (!editorDiv) console.warn("No #editor_root div found.");
    if (!buttonsDiv) console.warn("No #editor_buttons_root div found.");

    const App = () =>
        React.createElement(
            EditorProvider,
            { docId },
            React.createElement(EditorPane),
            buttonsDiv &&
                createPortal(React.createElement(ToolbarPane), buttonsDiv),
        );

    createRoot(editorDiv).render(React.createElement(App));
}

window.editorAPI.RenderEditor = RenderEditor;

RenderEditor();

export const waitForEditorAPI = Promise.resolve(window.editorAPI);
