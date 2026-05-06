// ── Syntax table ──────────────────────────────────────────────────────────────
export const SYNTAX = {
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

export function resolve(mode, key, ...args) {
    const entry = (SYNTAX[mode] || SYNTAX.Markdown)[key];
    return typeof entry === "function" ? entry(...args) : entry;
}

export const MATH_CYCLE = [null, "mathInline", "mathBlock"];
export const CODE_CYCLE = [null, "codeInline", "codeBlock"];
export const MATH_LABELS = ["M", "M·$", "M·$$"];
export const CODE_LABELS = ["<>", "<>`", "<>```"];

// ── Initial value ─────────────────────────────────────────────────────────────
export const initialValue = [
    {
        type: "paragraph",
        children: [
            {
                text: "Select text and use the toolbar, or place cursor to insert markers.",
            },
        ],
    },
];

// ── Prism language mapping ────────────────────────────────────────────────────
export const PRISM_LANG = {
    Markdown: "markdown",
    LaTeX: "latex",
    HTML: "html",
    Typst: "clike",
};

/**
 * Returns the Yjs delta between two strings.
 * @param {string} a - Original string.
 * @param {string} b - Modified string.
 * @returns {Array|null} - Delta array (e.g., [{ retain: 3 }, { delete: 1 }, { insert: "lo" }])
 *                         or null if strings are equal.
 */
export function getStringDelta(a, b) {
    const lenA = a.length;
    const lenB = b.length;

    // Find first differing index from the start
    let i = 0;
    while (i < lenA && i < lenB && a[i] === b[i]) {
        i++;
    }

    // If both strings are identical
    if (i === lenA && i === lenB) {
        return null;
    }

    // Find last differing index from the end
    let endA = lenA - 1;
    let endB = lenB - 1;
    while (endA >= i && endB >= i && a[endA] === b[endB]) {
        endA--;
        endB--;
    }

    const removedLength = endA - i + 1; // length of removed substring
    const added = b.slice(i, endB + 1);

    const delta = [];

    // Retain the common prefix (if any)
    if (i > 0) {
        delta.push({ retain: i });
    }

    // Delete the removed characters (if any)
    if (removedLength > 0) {
        delta.push({ delete: removedLength });
    }

    // Insert the new characters (if any)
    if (added.length > 0) {
        delta.push({ insert: added });
    }

    return delta;
}
