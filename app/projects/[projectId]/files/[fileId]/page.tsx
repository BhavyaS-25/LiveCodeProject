"use client";

import { useEffect, useRef, useState, use } from "react";

export default function FileEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>;
}) {
  const { projectId, fileId } = use(params);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("connecting");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const ws = new WebSocket(
      `ws://localhost:8000/ws/${projectId}/files/${fileId}?token=${token}`
    );

    socketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "edit") {
        setContent(data.content);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setStatus("disconnected");
    };

    return () => ws.close();
  }, [projectId, fileId]);

  return (
    <div style={{ padding: 40 }}>
      <h1>Editing File {fileId}</h1>
      <p>Status: {status}</p>

      <textarea
        value={content}
        onChange={(e) => {
          const newValue = e.target.value;
          setContent(newValue);

          const ws = socketRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "edit",
                content: newValue,
              })
            );
          }
        }}
        style={{ width: "100%", height: 300 }}
      />
    </div>
  );
}
