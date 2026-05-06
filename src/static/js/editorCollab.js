import { fileStore } from "/static/js/files.js";
import * as Y from "https://esm.sh/yjs";
import { WebsocketProvider } from "https://esm.sh/y-websocket";

// for (let [filename, c] of window.ydoc.share) {
//     if (!filename) continue;
//     content = ydoc.getText(filename);
//     yText.observe((event) => {
//         const latest = yText.toString();
//         // update your local state / UI with `latest`
//         fileStore[filename] = latest.toString();
//     });
// }
