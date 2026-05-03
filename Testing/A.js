// Global data structure as described
const globalStruct = {
    category1: [
        "black white red",
        "black white red",
        "black white red",
        "black white red",
    ],
    // other categories can be added
};

/**
 * Searches for the occurrenceValue-th occurrence of the word sequence
 * (previousWord, currentWord, nextWord) inside the given category.
 *
 * @param {number} occurrenceValue - Which occurrence to find (1‑based).
 * @param {string} category - The key in globalStruct to search in.
 * @param {string} previousWord - The word that must appear immediately before currentWord.
 * @param {string} currentWord - The target word.
 * @param {string} nextWord - The word that must appear immediately after currentWord.
 * @returns {Object|null} - An object with lineNumber, category, and column
 *                          (1‑based column of the last character of currentWord),
 *                          or null if not found.
 */
function searchOccurrence(
    occurrenceValue,
    category,
    previousWord,
    currentWord,
    nextWord,
) {
    const lines = globalStruct[category];
    if (!lines) {
        throw new Error(`Category "${category}" not found in globalStruct.`);
    }

    let matchCount = 0;

    // Iterate over each line (1‑based line number in the result)
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        // Regular expression to find all words (sequences of non‑whitespace characters)
        const wordRegex = /\S+/g;
        const words = [];
        const startIndices = []; // 0‑based index of the first character of each word

        let match;
        while ((match = wordRegex.exec(line)) !== null) {
            words.push(match[0]);
            startIndices.push(match.index);
        }

        // Scan through the words to find the exact triplet sequence
        for (let i = 0; i < words.length; i++) {
            if (words[i] === currentWord) {
                // Check that previous and next words exist and match
                const hasPrevious = i > 0 && words[i - 1] === previousWord;
                const hasNext =
                    i < words.length - 1 && words[i + 1] === nextWord;

                if (hasPrevious && hasNext) {
                    matchCount++;
                    if (matchCount === occurrenceValue) {
                        // Compute the 1‑based column where the current word ends
                        // startIndices[i] is 0‑based; adding currentWord.length gives
                        // the column number of the last character (1‑based).
                        const column = startIndices[i] + currentWord.length;
                        return {
                            lineNumber: lineIdx + 1,
                            category: category,
                            column: column,
                        };
                    }
                }
            }
        }
    }

    // No match found for the given occurrenceValue
    return null;
}

// Example usage:
// const result = searchOccurrence(4, "category1", "black", "white", "red");
// console.log(result);
// Output: { lineNumber: 4, category: "category1", column: 11 }
