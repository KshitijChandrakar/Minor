// ─── Pandoc loading ──────────────────────────────────────────────────────────
let pandocReadyPromise = null;
export let onFormatsLoaded = null;

export function loadPandoc() {
    if (pandocReadyPromise) return pandocReadyPromise;

    pandocReadyPromise = (async () => {
        const { createPandocInstance } = await import("/static/js/core.js");
        const response = await fetch("/static/js/pandoc.wasm");
        const wasmBinary = await response.arrayBuffer();
        const { convert, query, pandoc } =
            await createPandocInstance(wasmBinary);
        window.pandocModule = { convert, query, pandoc };

        const pandocVersion = await query({ query: "version" });
        const inputFormats = await query({ query: "input-formats" });
        const outputFormats = await query({ query: "output-formats" });

        if (onFormatsLoaded) onFormatsLoaded(inputFormats, outputFormats);
    })();

    return pandocReadyPromise;
}
