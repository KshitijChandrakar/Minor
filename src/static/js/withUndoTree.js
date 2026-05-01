// withUndoTree.js
import { Editor } from "https://esm.sh/slate";

let nextId = 1;
function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

/**
 * Slate plugin that replaces the built‑in linear history with an undo tree.
 * Each tree node stores a snapshot of `editor.children`.
 */
export function withUndoTree(editor) {
    const { apply, onChange } = editor;

    // ── Tree structure ──────────────────────────────────────────────────────
    const root = {
        id: 0,
        state: deepClone(editor.children),
        parent: null,
        children: [],
    };
    let current = root;
    let lastVisitedChild = null; // which child to redo into by default

    // queue of content operations that will become the next snapshot
    let pendingOps = [];
    let shouldSave = true;

    // ── Helpers ─────────────────────────────────────────────────────────────
    const flushQueue = () => {
        if (pendingOps.length === 0) return;
        if (!shouldSave) {
            pendingOps = [];
            return;
        }
        // Create a new node with the current document state
        const newNode = {
            id: nextId++,
            state: deepClone(editor.children),
            parent: current,
            children: [],
        };
        current.children.push(newNode);
        lastVisitedChild = newNode;
        current = newNode;
        pendingOps = [];
    };

    // operations that don’t change content are never saved
    const isIgnoredOp = (op) =>
        op.type === "set_selection" || op.type === "set_value";

    // ── Override apply ──────────────────────────────────────────────────────
    editor.apply = (op) => {
        apply(op);
        if (!isIgnoredOp(op)) {
            pendingOps.push(op);
        }
    };

    editor.onChange = () => {
        // Flush the queued operations into a new history state
        flushQueue();
        onChange();
    };

    // ── Disable saving inside a function ───────────────────────────────────
    editor.withoutSaving = (fn) => {
        const prev = shouldSave;
        shouldSave = false;
        try {
            fn();
        } finally {
            shouldSave = prev;
        }
    };

    // ── Undo / Redo ────────────────────────────────────────────────────────
    editor.undo = () => {
        if (!current.parent) return;
        lastVisitedChild = current;
        current = current.parent;
        editor.children = deepClone(current.state);
        editor.onChange();
    };

    editor.redo = () => {
        const children = current.children;
        if (children.length === 0) return;

        // Pick the last visited child if it still exists, otherwise the first
        const target =
            lastVisitedChild && children.includes(lastVisitedChild)
                ? lastVisitedChild
                : children[0];

        lastVisitedChild = target;
        current = target;
        editor.children = deepClone(target.state);
        editor.onChange();
    };

    // ── Expose tree data for visualisation ─────────────────────────────────
    editor.undoTree = {
        get root() {
            return root;
        },
        get current() {
            return current;
        },
        get lastVisitedChild() {
            return lastVisitedChild;
        },
    };

    return editor;
}
