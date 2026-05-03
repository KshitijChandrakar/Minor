/**
 * Returns the single change between two strings.
 * @param {string} a - Original string.
 * @param {string} b - Modified string.
 * @returns {Object|null} - Change descriptor or null if strings are equal.
 */
function getStringChanges(a, b) {
    const lenA = a.length;
    const lenB = b.length;

    // Find first differing index from the start
    let i = 0;
    while (i < lenA && i < lenB && a[i] === b[i]) {
        i++;
    }

    // If both strings are identical up to the end
    if (i === lenA && i === lenB) {
        return null; // no change
    }

    // Find last differing index from the end
    let endA = lenA - 1;
    let endB = lenB - 1;
    while (endA >= i && endB >= i && a[endA] === b[endB]) {
        endA--;
        endB--;
    }

    // Extract the differing substrings
    const removed = a.slice(i, endA + 1);
    const added = b.slice(i, endB + 1);

    // Determine the type of change
    let type;
    if (removed === "" && added !== "") type = "insert";
    else if (removed !== "" && added === "") type = "delete";
    else type = "replace";

    return {
        type,
        index: i,
        removed,
        added,
    };
}
