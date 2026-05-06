import { convertor } from "./PandocLoader.js";
import { getStringDelta } from "./editorHelpers.js";
import { debounce } from "./HelperFunctions.js";
import { filesChanged, activeFile, fileStore } from "./files.js";
// import * as Y from "yjs";

/**
 * Syncs a Y.Text instance from oldString → newString using a
 * character-level diff, all inside one Y transaction.
 *
 * @param {Y.Text}  yText
 * @param {string}  oldString
 * @param {string}  newString
 * @param {Y.Doc}   ydoc       – the document that owns the YText
 */
export function syncYText(yText, oldString, newString, ydoc) {
    const ops = diffToOps(oldString, newString);
    console.log(ops);

    ydoc.transact(() => {
        let cursor = 0;

        for (const op of ops) {
            if (op.type === "retain") {
                cursor += op.count;
            } else if (op.type === "delete") {
                yText.delete(cursor, op.count);
                // cursor does NOT advance; deleted chars are gone
            } else if (op.type === "insert" && op.text) {
                console.log("Inserting", cursor, op.text);
                yText.insert(cursor, op.text);
                cursor += op.text.length;
            }
        }
    });
}

/**
 * Produces a minimal list of retain / delete / insert operations
 * that transform `a` into `b` using the Myers diff algorithm.
 *
 * @param {string} a  old string
 * @param {string} b  new string
 * @returns {{ type: 'retain'|'delete'|'insert', count?: number, text?: string }[]}
 */
function diffToOps(a, b) {
    // Myers diff – returns an array of [type, value] pairs
    const lcs = myersDiff(a, b);
    const ops = [];
    for (const [type, value] of lcs) {
        if (type === "=") {
            ops.push({ type: "retain", count: value.length });
        } else if (type === "-") {
            ops.push({ type: "delete", count: value.length });
        } else if (type === "+") {
            ops.push({ type: "insert", text: value });
        }
    }

    return ops;
}

/**
 * Myers shortest-edit-script diff (character level).
 * Returns [['=', str], ['-', str], ['+', str], …]
 */
function myersDiff(a, b) {
    const n = a.length,
        m = b.length;
    const max = n + m;
    const v = new Array(2 * max + 1).fill(0);
    const trace = [];
    outer: for (let d = 0; d <= max; d++) {
        trace.push([...v]);
        for (let k = -d; k <= d; k += 2) {
            const idx = k + max;
            let x;
            if (k === -d || (k !== d && v[idx - 1] < v[idx + 1])) {
                x = v[idx + 1]; // move down  (insert)
            } else {
                x = v[idx - 1] + 1; // move right (delete)
            }
            let y = x - k;
            while (x < n && y < m && a[x] === b[y]) {
                x++;
                y++;
            }
            v[idx] = x;
            if (x >= n && y >= m) {
                trace.push([...v]);
                break outer;
            }
        }
    }

    // Back-track through the trace to build the edit script
    const script = [];
    let x = n,
        y = m;
    for (let d = trace.length - 1; d > 0; d--) {
        const vPrev = trace[d - 1];
        const k = x - y;
        const idx = k + max;
        const kPrev =
            k === -(d - 1) || (k !== d - 1 && vPrev[idx - 1] < vPrev[idx + 1])
                ? k + 1 // came from above → insert
                : k - 1; // came from left  → delete

        const xPrev = vPrev[kPrev + max];
        const yPrev = xPrev - kPrev;

        // diagonal (equal) moves
        while (x > xPrev && y > yPrev) {
            script.push(["=", a[--x]]);
            y--;
        }

        if (x > xPrev)
            script.push(["-", a[--x]]); // delete from a
        else if (y > yPrev) script.push(["+", b[--y]]); // insert from b
    }

    // Collapse consecutive same-type ops into single entries
    const raw = script.reverse();
    const merged = [];
    for (const [type, ch] of raw) {
        if (merged.length && merged[merged.length - 1][0] === type) {
            merged[merged.length - 1][1] += ch;
        } else {
            merged.push([type, ch]);
        }
    }
    return merged;
}

let PreviousText = "";
// console.log(yText.toString()); // → "Hello Yjs World!"

export async function SaveToYdoc(text, filename) {
    syncYText(window.ydoc.getText(filename), PreviousText, text, window.ydoc);
    console.log("Synced YText");
    PreviousText = text;
}

export async function SaveToServer(text) {
    // Check if the active file has been changed
    if (filesChanged[activeFile] != true) return;

    // Get the content from fileStore if the file hasn't been changed
    const fileContent = await convertorJSON(fileStore[activeFile]);
    let projectId = window.projectId;

    // If you want to only send the active file that has changed:
    const activeFilePayload = {
        [projectId]: [
            {
                filename: activeFile,
                newContent: fileContent,
            },
        ],
    };
    try {
        const response = await fetch("/api/filesChange", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(activeFilePayload), // or payload for multiple files
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Success:", result);

        return result;
    } catch (error) {
        console.error("Error saving to server:", error);
    }
}
