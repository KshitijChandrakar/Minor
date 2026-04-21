import {} from "/static/js/buttons.js";
import { fileStore, mainFile, activeFile, renderSidebar } from "./files.js";
import "/static/js/jszip.min.js";

let createPdfButton = document.getElementById("Download");
createPdfButton.addEventListener("click", function () {
    createPdf(fileStore[mainFile]);
});

export function createPdf(mainContent) {
    console.time("Typst Compile");
    console.log("Compiling with Content", mainContent);

    try {
        syncFilesToTypst();
    } catch (syncError) {
        console.timeEnd("Typst Compile");
        console.error("Sync Error:", syncError);
        RenderError(syncError);
        return;
    }

    $typst
        .pdf({ mainContent })
        .then((pdfData) => {
            console.timeEnd("Typst Compile");
            console.log("PDF generated successfully");

            try {
                const pdfFile = new Blob([pdfData], {
                    type: "application/pdf",
                });
                const link = document.createElement("a");
                const url = URL.createObjectURL(pdfFile);

                link.href = url;
                link.target = "_blank";
                link.download = "document.pdf"; // Add download attribute for better UX
                link.click();

                // Clean up
                URL.revokeObjectURL(url);
            } catch (blobError) {
                console.error("Error creating PDF blob:", blobError);
                RenderError(blobError);
            }
        })
        .catch((err) => {
            console.timeEnd("Typst Compile");
            console.error("Compilation Error:", err);
            RenderError(err);
        });
}

const arrowBtn = document.getElementById("DropdownArrow");
const menu = document.getElementById("DropdownMenu");

export async function makeFiles(format) {
    const fromFormat = window.formatMap[window.currentState];
    const toFormat = window.formatMap[format];

    fileStore[activeFile] = window.editorAPI.getValue();

    const fileNames = Object.keys(fileStore);
    const convertedMap = {}; // name → converted string

    for (const name of fileNames) {
        try {
            const result = await window.pandocModule.convert(
                {
                    from: fromFormat,
                    to: toFormat,
                    "output-file": "output.txt",
                    "resource-path": ["."],
                },
                fileStore[name],
                {},
            );

            if (result.files?.["output.txt"]) {
                convertedMap[name] = await result.files["output.txt"].text();
            } else {
                // Conversion produced no output — keep original content
                convertedMap[name] = fileStore[name];
            }
        } catch (err) {
            console.error(`Conversion failed for "${name}":`, err);
            convertedMap[name] = fileStore[name]; // fallback: keep original
        }
    }
    console.log("convertedMap", convertedMap);

    // Create and download zip file with the target format
    await createAndDownloadZip(convertedMap, toFormat);
}

async function createAndDownloadZip(files, targetFormat) {
    // Dynamically load JSZip from unpkg
    const zip = new JSZip();

    // Map file extensions for different formats
    const extensionMap = {
        markdown: ".md",
        html: ".html",
        latex: ".tex",
        pdf: ".pdf",
        docx: ".docx",
        plain: ".txt",
        json: ".json",
        text: ".txt",
    };

    const targetExtension = extensionMap[targetFormat] || ".txt";

    // Add all files to the zip
    for (const [filename, content] of Object.entries(files)) {
        // Change the file extension to match the target format
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
        const outputFilename = nameWithoutExt + targetExtension;

        zip.file(outputFilename, content);
    }

    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Create download link
    const downloadLink = document.createElement("a");
    const url = URL.createObjectURL(zipBlob);
    downloadLink.href = url;
    downloadLink.download = `converted_files_${targetFormat}_${Date.now()}.zip`;

    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // Clean up
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    console.log(
        `Zip file downloaded successfully with ${Object.keys(files).length} files`,
    );
}

arrowBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = menu.style.display === "block";
    menu.style.display = isVisible ? "none" : "block";
});

document.addEventListener("click", () => {
    menu.style.display = "none";
});

menu.addEventListener("click", (e) => {
    const target = e.target.closest("[data-format]");
    if (target) {
        const format = target.getAttribute("data-format");
        // console.log(`Selected format: ${format}`);
        makeFiles(format);
        // Here you would implement the actual export logic for each format
        menu.style.display = "none";
    }
});
