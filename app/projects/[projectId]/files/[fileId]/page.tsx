"use client";


import { useEffect, useRef, useState, use } from "react";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import styles from "./editorPage.module.css"; 
import { useRouter } from "next/navigation";



export default function FileEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>;
}) {
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<
  "connecting" | "connected" | "disconnected"
>("connecting");
  const currentUserRef = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const remoteCursorsRef = useRef<Record<string, number>>({});
  const decorationsRef = useRef<string[]>([]);
  const userColorsRef = useRef<Record<string, string>>({});
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [remotePending, setRemotePending] = useState(false);
  const [pendingRemoteContent, setPendingRemoteContent] = useState<string | null>(null);
  const [editors, setEditors] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { projectId, fileId } = use(params);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string>("");
  const socketRef = useRef<WebSocket | null>(null);
  const othersEditing =
  currentUser
    ? editors.filter((u) => u !== currentUser)
    : editors;
  type FileTab = {
    id: number;
    name: string;
    content: string;
    language: string;
  };
  type ProjectFile = {
    id: number;
    name: string;
  }
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [openTabs, setOpenTabs] = useState<FileTab[]>([]);
  const [activeFileId, setActiveFileId] = useState<number | null>(null);


  function getLanguageFromFilename(filename: string) {
    const ext = filename.split(".").pop();
    switch (ext) {
      case "js":
        return "javascript";
      case "ts":
        return "typescript";
      case "py":
        return "python";
      case "java":
        return "java";
      case "json":
        return "json";
      case "html":
        return "html";
      case "css":
        return "css";
      default:
        return "plaintext";
    }
  }
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`http://localhost:8000/projects/${projectId}/files`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    })
    .then((data) => {
      setFiles(data);
    })
    .catch(console.error);
  }, [projectId])

  useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    return;
  }
  function renderRemoteCursors() {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;

    const decorations = Object.entries(remoteCursorsRef.current).map(
      ([user, offset]) => {
        const position = model.getPositionAt(offset);

        return {
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            className: "remote-cursor",
            hoverMessage: { value: `👤 ${user}` },
          },
        };
      }
    );

  decorationsRef.current = editor.deltaDecorations(
    decorationsRef.current,
    decorations
  );
}
function getColorForUser(username: string) {
  if (!userColorsRef.current[username]) {
    const colors = [
      "#ff5555",
      "#50fa7b",
      "#8be9fd",
      "#bd93f9",
      "#f1fa8c",
      "#ff79c6",
    ];
    const index =
      username.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
      colors.length;

    userColorsRef.current[username] = colors[index];
  }
  return userColorsRef.current[username];
}


async function openFile(fileId: number, name: string) {
  const token = localStorage.getItem("token");

  const res = await fetch(
    `http://localhost:8000/projects/${projectId}/files/${fileId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await res.json();

  setOpenTabs((prev) => {
    if (prev.some((f) => f.id === fileId)) return prev;

    return [
      ...prev,
      {
        id: fileId,
        name,
        content: data.content,
        language: getLanguageFromFilename(name),
      },
    ];
  });

  setActiveFileId(fileId);
  setContent(data.content);
  setFileName(name);
}

  fetch(
    `http://localhost:8000/projects/${projectId}/files/${fileId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load file");
      return res.json();
    })
    .then((data) => {
      setContent(data.content);
      setFileName(data.name)
    })
    .catch((err) => {
      console.error(err);
    });
  fetch("http://localhost:8000/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  .then((res) => res.json())
  .then((data) => setCurrentUser(data.username));

  const ws = new WebSocket(
    `ws://localhost:8000/ws/${projectId}/files/${fileId}?token=${token}`
  );

  socketRef.current = ws;

  ws.onopen = () => {
    setConnectionStatus("connected");
  }
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === "presence") {
      setEditors(data.users);
      Object.keys(remoteCursorsRef.current).forEach((user) => {
        if (!data.users.includes(user)) {
          delete remoteCursorsRef.current[user];
        }
      });

      renderRemoteCursors();
      return;
    }

    if (data.type === "edit") {
      if (data.user === currentUserRef.current) return;
      setContent(data.content);
    }
    if (data.type === "cursor") {
      if (data.user === currentUserRef.current) return;

      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model) return;

      const position = model.getPositionAt(data.position);
      const color = getColorForUser(data.user);

      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        [
          {
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            options: {
              className: "remote-cursor",
              afterContentClassName: "remote-cursor-label",
              hoverMessage: { value: data.user },
              stickiness:
                monaco.editor.TrackedRangeStickiness
                  .NeverGrowsWhenTypingAtEdges,
            },
          },
        ]
      );


      const styleId = `cursor-style-${data.user}`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          .remote-cursor {
            border-left: 2px solid ${color};
            margin-left: -1px;
          }
          .remote-cursor-label::after {
            content: "${data.user}";
            background: ${color};
            color: black;
            font-size: 10px;
            padding: 2px 4px;
            border-radius: 4px;
            margin-left: 4px;
          }
        `;
        document.head.appendChild(style);
      }
    }



  };
  ws.onclose = () => {
    setConnectionStatus("disconnected");
    setEditors([]);
  };

  return () => {
    ws.close();
  };
}, [projectId, fileId]);

  return (
    <div className = {styles.editorPage}>
      <aside className= {styles.fileSidebar}>
        <h3> Files </h3>
        <ul className={styles.fileList}>
        {files.map((file) => (
          <li
            key={file.id}
            className={
              file.id === activeFileId
                ? styles.activeFile
                : styles.fileItem
            }
            onClick={() => {router.push(`/projects/${projectId}/files/${file.id}`);}}
          >
            {file.name}
          </li>
        ))}
      </ul>
    </aside>

      <main className = {styles.editorMain}>
        <header className = {styles.editorHeader}>
          <h1> {fileName} </h1>
        </header>

      <div className={styles.statusBar}>
        <div className={styles.leftStatus}>
          <span
            className={
              connectionStatus === "connected"
                ? styles.connected
                : styles.disconnected
            }
          >
            ● {connectionStatus}
          </span>

          <span className={styles.saveStatus}>
            {saveStatus === "saving" ? "Saving…" : "Saved"}
          </span>
        </div>

        <div className={styles.rightStatus}>
          {othersEditing.length > 0 && (
            <span>👥 {othersEditing.length} editing</span>
          )}
        </div>
      </div>

    <div className={styles.editor}>
      <Editor
      height="100%"
      language={getLanguageFromFilename(fileName)}
      value={content}
      theme="vs-dark"
      onMount={(editor) => {
        editorRef.current = editor;

        editor.onDidChangeCursorPosition((e) => {
          const ws = socketRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) return;

          ws.send(
            JSON.stringify({
              type: "cursor",
              position: editor.getModel()?.getOffsetAt(e.position),
            })
          );
        });
      }}
      onChange={(value) => {
        const newValue = value ?? "";
        setContent(newValue);
        setSaveStatus("saving");

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          const ws = socketRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "edit",
                content: newValue,
              })
            );
            setSaveStatus("saved");
          }
        }, 200);
      }}
    />
        </div>
      </main>
    </div>
  );
}
