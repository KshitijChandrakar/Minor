function extractMessageFromBraces(inputString) {
    // Find the message pattern: message: "text here"
    const messageMatch = inputString.match(/message:\s*"([^"]+)"/);

    if (messageMatch) {
        return messageMatch[1];
    }

    return null;
}

// Test
export function RenderError(err) {
    const sidebar = document.getElementById("error-sidebar-content");

    const errorMessage = extractMessageFromBraces(err.toString());
    console.log(errorMessage);

    sidebar.innerHTML = `
        <span>${errorMessage}</span>
    `;
}
