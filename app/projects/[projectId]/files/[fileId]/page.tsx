"use client";

import { use, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type * as Monaco from "monaco-editor";
import { useRouter } from "next/navigation";
import styles from "./editorPage.module.css";
import { ApiError, apiRequest, getToken, websocketUrl } from "../../../../../lib/api";

const Editor = dynamic(() => import("../../../../components/CodeEditor"), { ssr: false });

type ProjectFile = { id: number; name: string; content?: string; version?: number };
type SaveStatus = "saved" | "unsaved" | "saving" | "conflict";
type Conflict = { content: string; version: number; message: string };
type SocketMessage = { type: string; content?: string; version?: number; user?: string; users?: string[]; position?: number; message?: string };

function languageFor(name: string) {
  return ({ js: "javascript", ts: "typescript", py: "python", java: "java", json: "json", html: "html", css: "css", md: "markdown" } as Record<string, string>)[name.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext";
}

export default function FileEditorPage({ params }: { params: Promise<{ projectId: string; fileId: string }> }) {
  const { projectId, fileId } = use(params);
  return <FileEditorWorkspace key={`${projectId}:${fileId}`} projectId={projectId} fileId={fileId} />;
}

function FileEditorWorkspace({ projectId, fileId }: { projectId: string; fileId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [editors, setEditors] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef("");
  const versionRef = useRef(0);
  const authenticatedRef = useRef(false);
  const loadedRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const saveStatusRef = useRef<SaveStatus>("saved");
  const pendingEditRef = useRef<string | null>(null);
  const queuedEditRef = useRef<string | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const remoteCursorsRef = useRef<Record<string, number>>({});
  const decorationsRef = useRef<string[]>([]);
  const beforeUnloadRef = useRef(false);
  const sendEditRef = useRef<(value?: string) => boolean>(() => false);
  const showConflictRef = useRef<(content: string, version: number, message: string) => void>(() => undefined);

  function setSaveState(status: SaveStatus) {
    saveStatusRef.current = status;
    beforeUnloadRef.current = status !== "saved";
    setSaveStatus(status);
  }
  function applyServerContent(nextContent: string, nextVersion: number) {
    applyingRemoteRef.current = true;
    contentRef.current = nextContent;
    versionRef.current = nextVersion;
    setContent(nextContent);
    window.setTimeout(() => { applyingRemoteRef.current = false; }, 0);
  }
  function showConflict(nextContent: string, nextVersion: number, message: string) {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    queuedEditRef.current = null;
    setConflict({ content: nextContent, version: nextVersion, message });
    setSaveState("conflict");
  }
  function showHttpConflict(err: unknown) {
    if (!(err instanceof ApiError) || err.status !== 409 || typeof err.data !== "object" || err.data === null) return false;
    const detail = (err.data as { detail?: unknown }).detail;
    const data = (typeof detail === "object" && detail !== null ? detail : err.data) as { content?: unknown; version?: unknown };
    if (typeof data.content !== "string" || typeof data.version !== "number") return false;
    showConflict(data.content, data.version, "This file changed before your edit was saved.");
    return true;
  }
  function renderRemoteCursors() {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const decorations: Monaco.editor.IModelDeltaDecoration[] = Object.entries(remoteCursorsRef.current).map(([username, offset]) => {
      const position = model.getPositionAt(Math.max(0, Math.min(offset, model.getValueLength())));
      return { range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column }, options: { className: "remote-cursor", hoverMessage: { value: username } } };
    });
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }
  function sendEdit(value = contentRef.current) {
    const socket = socketRef.current;
    if (!loadedRef.current || pendingEditRef.current !== null || saveStatusRef.current === "conflict") return false;
    if (!socket || socket.readyState !== WebSocket.OPEN || !authenticatedRef.current) {
      setSaveState("unsaved");
      return false;
    }
    try {
      pendingEditRef.current = value;
      socket.send(JSON.stringify({ type: "edit", content: value, version: versionRef.current }));
      setSaveState("saving");
      return true;
    } catch {
      pendingEditRef.current = null;
      setSaveState("unsaved");
      setError("The connection dropped before this edit could be saved.");
      return false;
    }
  }
  useEffect(() => {
    sendEditRef.current = sendEdit;
    showConflictRef.current = showConflict;
  });

  function scheduleSave(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (pendingEditRef.current !== null) queuedEditRef.current = value;
      else sendEdit(value);
    }, 350);
  }

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!beforeUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    let cancelled = false;
    apiRequest<ProjectFile[]>(`/projects/${projectId}/files`).then((data) => { if (!cancelled) setFiles(data); }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load files."); });
    apiRequest<ProjectFile>(`/projects/${projectId}/files/${fileId}`).then((data) => {
      if (cancelled) return;
      setFileName(data.name);
      if (!authenticatedRef.current) applyServerContent(data.content ?? "", data.version ?? 0);
      loadedRef.current = true;
      setLoaded(true);
    }).catch((err) => {
      if (cancelled) return;
      if (err instanceof ApiError && err.status === 401) router.replace("/login");
      else setError(err instanceof Error ? err.message : "Unable to load this file.");
    });
    apiRequest<{ id: number; username: string }>("/auth/me").then((data) => { if (!cancelled) setCurrentUser(data.username); }).catch(() => { /* the file request provides the actionable error */ });

    let socket: WebSocket;
    try { socket = new WebSocket(websocketUrl(`/ws/${projectId}/files/${fileId}`)); }
    catch {
      window.setTimeout(() => {
        if (!cancelled) {
          setConnectionStatus("disconnected");
          setError("Could not open the live editing connection.");
        }
      }, 0);
      return;
    }
    socketRef.current = socket;
    socket.onopen = () => { try { socket.send(JSON.stringify({ type: "auth", token })); } catch { setConnectionStatus("disconnected"); } };
    socket.onmessage = (event) => {
      let message: SocketMessage;
      try { message = JSON.parse(String(event.data)) as SocketMessage; } catch { setError("Received an invalid live update."); return; }
      if (message.type === "auth_ok") {
        authenticatedRef.current = true;
        setConnectionStatus("connected");
        if (typeof message.content === "string" && typeof message.version === "number") applyServerContent(message.content, message.version);
        if (message.user) setCurrentUser(message.user);
        loadedRef.current = true;
        setLoaded(true);
        return;
      }
      if (message.type === "error") { pendingEditRef.current = null; queuedEditRef.current = null; if (saveStatusRef.current !== "conflict") setSaveState("unsaved"); setError(message.message || "The server rejected this update."); return; }
      if (message.type === "presence") {
        const users = Array.isArray(message.users) ? message.users : [];
        setEditors(users);
        for (const username of Object.keys(remoteCursorsRef.current)) { if (!users.includes(username)) delete remoteCursorsRef.current[username]; }
        renderRemoteCursors();
        return;
      }
      if (message.type === "cursor" && typeof message.user === "string" && typeof message.position === "number") {
        remoteCursorsRef.current[message.user] = message.position;
        renderRemoteCursors();
        return;
      }
      if (message.type === "saved" && typeof message.version === "number") {
        const sent = pendingEditRef.current;
        pendingEditRef.current = null;
        if (saveStatusRef.current === "conflict") return;
        versionRef.current = message.version;
        if (typeof message.content === "string" && sent !== null && message.content !== sent) {
          showConflictRef.current(message.content, message.version, "The server saved a different version while your edit was in flight.");
          return;
        }
        const queued = queuedEditRef.current;
        queuedEditRef.current = null;
        if (queued !== null && queued !== (message.content ?? sent)) {
          sendEditRef.current(queued);
        } else {
          setSaveState("saved");
        }
        return;
      }
      if (message.type === "edit" && typeof message.content === "string" && typeof message.version === "number") {
        if (message.version <= versionRef.current) return;
        if (saveStatusRef.current === "conflict") return;
        if (pendingEditRef.current !== null || queuedEditRef.current !== null || saveStatusRef.current === "unsaved") {
          showConflictRef.current(message.content, message.version, "Another editor saved a newer version. Your local text has not been overwritten.");
        } else {
          applyServerContent(message.content, message.version);
          setSaveState("saved");
        }
        return;
      }
      if (message.type === "conflict" && typeof message.content === "string" && typeof message.version === "number" && saveStatusRef.current !== "conflict") {
        pendingEditRef.current = null;
        showConflictRef.current(message.content, message.version, "This file changed before your edit was saved.");
      }
    };
    socket.onerror = () => { if (!cancelled) setError("Live editing connection encountered an error."); };
    socket.onclose = () => { authenticatedRef.current = false; if (!cancelled) { setConnectionStatus("disconnected"); setEditors([]); if (pendingEditRef.current !== null) { queuedEditRef.current = pendingEditRef.current; pendingEditRef.current = null; } if (saveStatusRef.current !== "conflict") setSaveState("unsaved"); } };
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); socket.close(); socketRef.current = null; };
  }, [fileId, projectId, router]);

  function onChange(value: string | undefined) {
    if (!loadedRef.current || applyingRemoteRef.current) return;
    const nextValue = value ?? "";
    contentRef.current = nextValue;
    setContent(nextValue);
    if (saveStatusRef.current === "conflict") return;
    if (pendingEditRef.current !== null) { queuedEditRef.current = nextValue; setSaveState("saving"); return; }
    setSaveState("unsaved");
    scheduleSave(nextValue);
  }
  function onMount(editor: Monaco.editor.IStandaloneCodeEditor) {
    editorRef.current = editor;
    renderRemoteCursors();
    editor.onDidChangeCursorPosition((event) => {
      const socket = socketRef.current;
      const model = editor.getModel();
      if (!loadedRef.current || !authenticatedRef.current || !socket || socket.readyState !== WebSocket.OPEN || !model) return;
      try { socket.send(JSON.stringify({ type: "cursor", position: model.getOffsetAt(event.position) })); } catch { /* close handler exposes retry UI */ }
    });
  }
  async function saveViaHttp() {
    if (!loadedRef.current || saveStatusRef.current === "conflict") return false;
    if (pendingEditRef.current !== null) { setError("Wait for the current save confirmation before navigating."); return false; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const value = contentRef.current;
    try {
      setSaveState("saving");
      const saved = await apiRequest<ProjectFile>(`/projects/${projectId}/files/${fileId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: value, version: versionRef.current }) });
      versionRef.current = saved.version ?? versionRef.current + 1;
      pendingEditRef.current = null;
      queuedEditRef.current = null;
      if (contentRef.current !== value) {
        setSaveState("unsaved");
        if (authenticatedRef.current) scheduleSave(contentRef.current);
        setError("More edits were made during the save. Wait for them to save before navigating.");
        return false;
      }
      setSaveState("saved");
      setError(null);
      return true;
    } catch (err) {
      if (!showHttpConflict(err)) { setSaveState("unsaved"); setError(err instanceof Error ? err.message : "Could not save this file."); }
      return false;
    }
  }
  async function navigateTo(nextId: number) {
    if (nextId === Number(fileId)) return;
    if (saveStatusRef.current === "conflict") { setError("Resolve the conflict before opening another file."); return; }
    if (saveStatusRef.current !== "saved" && !(await saveViaHttp())) return;
    router.push(`/projects/${projectId}/files/${nextId}`);
  }
  async function leaveFiles() {
    if (saveStatusRef.current === "conflict") { setError("Resolve the conflict before leaving this file."); return; }
    if (saveStatusRef.current !== "saved" && !(await saveViaHttp())) return;
    router.push(`/projects/${projectId}/files`);
  }
  function useServerVersion() {
    if (!conflict) return;
    pendingEditRef.current = null;
    queuedEditRef.current = null;
    applyServerContent(conflict.content, conflict.version);
    setConflict(null);
    setSaveState("saved");
  }
  function overwriteWithMine() {
    if (!conflict) return;
    versionRef.current = conflict.version;
    setConflict(null);
    pendingEditRef.current = null;
    queuedEditRef.current = null;
    setSaveState("unsaved");
    if (!sendEdit(contentRef.current)) setSaveState("unsaved");
  }
  const othersEditing = currentUser ? editors.filter((user) => user !== currentUser) : editors;
  const needsRetry = connectionStatus === "disconnected" && saveStatus !== "saved" && saveStatus !== "conflict";

  return <div className={styles.editorPage}><aside className={styles.fileSidebar}><h3>Files</h3><ul className={styles.fileList}>{files.map((file) => <li key={file.id} className={file.id === Number(fileId) ? styles.activeFile : styles.fileItem} onClick={() => void navigateTo(file.id)}>{file.name}</li>)}</ul></aside>
    <main className={styles.editorMain}><header className={styles.editorHeader}><h1>{fileName || "Loading file..."}</h1><button className={styles.backButton} onClick={() => void leaveFiles()}>Back</button></header>
      <div className={styles.statusBar}><div className={styles.leftStatus}><span className={connectionStatus === "connected" ? styles.connected : styles.disconnected}>● {connectionStatus}</span><span className={styles.saveStatus}>{saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved changes" : saveStatus === "conflict" ? "Conflict needs attention" : "Saved"}</span></div><div className={styles.rightStatus}>{othersEditing.length > 0 && <span>{othersEditing.length} editing</span>}</div></div>
      {error && <p className={styles.message} role="alert">{error}</p>}
      {needsRetry && <div className={styles.retry}><span>Live connection is offline. Your changes are still local.</span><button onClick={() => void saveViaHttp()}>Save over HTTP</button></div>}
      {conflict && <div className={styles.conflict} role="alert"><strong>Version conflict</strong><span>{conflict.message} Concurrent edits need an explicit choice; automatic merging is not enabled.</span><div><button onClick={useServerVersion}>Use server version</button><button onClick={overwriteWithMine}>Overwrite with my version</button></div></div>}
      <div className={styles.editor}><Editor height="100%" language={languageFor(fileName)} value={content} theme="vs-dark" onMount={onMount} onChange={onChange} options={{ minimap: { enabled: false }, readOnly: !loaded || connectionStatus === "connecting" }} /></div>
    </main></div>;
}
