// ─── Pandoc loading ──────────────────────────────────────────────────────────
let pandocReadyPromise = null;
export let onFormatsLoaded = null;

function loadPandoc() {
    if (pandocReadyPromise) return pandocReadyPromise;

    pandocReadyPromise = (async () => {
        const { createPandocInstance } = await import("./core.js");
        const response = await fetch("./static/js/pandoc.wasm");
        const wasmBinary = await response.arrayBuffer();
        const { convert, query } = await createPandocInstance(wasmBinary);
        window.pandocModule = { convert, query };

        const pandocVersion = await query({ query: "version" });
        const inputFormats = await query({ query: "input-formats" });
        const outputFormats = await query({ query: "output-formats" });

        if (onFormatsLoaded) onFormatsLoaded(inputFormats, outputFormats);
    })();

    console.log("loaded Pandoc");
    return pandocReadyPromise;
}

loadPandoc().catch((err) => console.error("Failed to load pandoc:", err));
