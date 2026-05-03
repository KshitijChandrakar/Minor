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

export async function convertor(text) {
    let fromFormat = window.formatMap[window.currentState];
    if (fromFormat == "typst") {
        return text;
    }
    try {
        const previewResult = await window.pandocModule.convert(
            {
                from: fromFormat,
                to: "typst",
                "output-file": "output.txt",
                "resource-path": ["."],
            },
            text ?? "",
            {},
        );
        // console.warn(fromFormat + text);
        console.log(await previewResult.files["output.txt"].text());

        return previewResult.files["output.txt"].text();
    } catch (err) {
        console.error("conversion failed:", err);
    }
}

export async function convertorJSON(text) {
    const startTime = performance.now(); // Start timer
    let fromFormat = window.formatMap[window.currentState];
    if (fromFormat == "typst")
        try {
            const previewResult = await window.pandocModule.convert(
                {
                    from: fromFormat,
                    to: "json",
                    "output-file": "output.txt",
                    "resource-path": ["."],
                },
                text ?? "",
                {},
            );
            const textContent = await previewResult.files["output.txt"].text();
            const elapsed = performance.now() - startTime; // Calculate elapsed time
            console.log(`[${elapsed}ms]`, textContent); // Log with timer
            return textContent;
        } catch (err) {
            console.error("conversion failed:", err);
        }
}
