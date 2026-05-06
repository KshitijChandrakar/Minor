/**
 * Returns the Yjs delta between two strings.
 * @param {string} a - Original string.
 * @param {string} b - Modified string.
 * @returns {Array|null} - Delta array (e.g., [{ retain: 3 }, { delete: 1 }, { insert: "lo" }])
 *                         or null if strings are equal.
 */
function getStringDelta(a, b) {
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

// Examples:
console.log(getStringDelta("hello", "hella"));
// [{ retain: 4 }, { delete: 1 }, { insert: "a" }]

console.log(getStringDelta("hello", "hell"));
// [{ retain: 4 }, { delete: 1 }]

console.log(getStringDelta("hel", "hello"));
// [{ retain: 3 }, { insert: "lo" }]

console.log(getStringDelta("abc", "abc"));
// null

console.log(getStringDelta("hello world", "hello"));
// [{ retain: 5 }, { delete: 6 }]  (deletes " world")
