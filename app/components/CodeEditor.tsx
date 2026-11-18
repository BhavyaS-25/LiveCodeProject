"use client";

import Editor, { loader, type EditorProps } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Bundle the installed, audited editor instead of fetching a separate version at runtime.
loader.config({ monaco });
if (typeof window !== "undefined") {
  (window as Window & { MonacoEnvironment?: { getWorker: (_module: string, label: string) => Worker } }).MonacoEnvironment = {
    getWorker(_module, label) {
      const kind = label === "typescript" || label === "javascript" ? "typescript"
        : label === "json" ? "json" : label === "css" || label === "scss" || label === "less" ? "css"
        : label === "html" || label === "handlebars" || label === "razor" ? "html" : "editor";
      return new Worker(`/monaco-workers/${kind}.js`);
    },
  };
}

export default function CodeEditor(props: EditorProps) {
  return <Editor {...props} />;
}
