"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./projects.module.css"; 

type Project = {
    id: number;
    name: string;
    owner_id: number;
};

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newProject, setNewProject] = useState("");
    const [creating, setCreating] = useState(false);
    const [memberInputs, setMemberInputs] = useState<Record<number, string>>({});
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [shareProjectId, setShareProjectId] = useState<number | null>(null);
    const [shareUsername, setShareUsername] = useState("");


    
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login";
            return;
        }
        async function fetchProjects() {
            try {
                const res = await fetch("http://localhost:8000/projects", {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    
                }
            );
                if (!res.ok) {
                    throw new Error("failed to fetch projects.");
                }
                const data = await res.json();
                setProjects(data)
            } catch (err: any) {
                setError(err.message || "Something went wrong")
            } finally {
                setLoading(false)

            }
        }
        fetchProjects();
    }, []);
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        fetch("http://localhost:8000/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setCurrentUserId(data.id));
        }, []);

    async function addMember(projectId: number, username: string) {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Not authenticated");
            return;
        }
        const res = await fetch(
            `http://localhost:8000/projects/${projectId}/members?username=${encodeURIComponent(
            username
            )}`,
            {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            }
        );
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || "Failed to add member");
        }
        return await res.json();
    }
    async function deleteProject(projectId: number) {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`http://localhost:8000/projects/${projectId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to delete project");
        }
        }

    async function createProject() {
        const token = localStorage.getItem("token");
        if(!token) {
            window.location.href = "/login";
            return;
        }
        if (!newProject.trim()) return;
        
        try {
            setCreating(true);
            const res = await fetch("http://localhost:8000/projects", {
                method: "POST",
                headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({name: newProject}),
            });
            if (!res.ok) {
                throw new Error("Failed to create Project")
            }
            const data = await res.json();
            setProjects((prev) => [...prev, data.project]);
            setNewProject("");
        } catch (err: any) {
            setError(err.message || "Could not create Project");
        } finally {
            setCreating(false);
        }
    }
    if (loading) {
        return <p style = {{ padding: 40 }}>Loading projects...</p>
    }
    if (error) {
        return (
            <div style = {{padding: 40}}>
                <p style = {{color: "red"}}>{error}</p>
                <button onClick={() => (window.location.href = "/login")}>
                    Back to Login Page
                </button>
            </div>
        );
    }
    return (
        <div className = {styles.page}> 
            <h1 className = {styles.title}> My Projects </h1>
            <div className = {styles.createRow}>
                <input placeholder = "New project name"
                value= {newProject}
                onChange = {(e) => setNewProject(e.target.value)}
            />
            <button
                onClick={createProject}
                disabled={creating}
                className= {styles.createBtn}
            >
                {creating ? "Creating..." : "Create Project"}
            </button>
            </div>

            {projects.length === 0 && <p> No projects yet.</p>}
            
           <ul className= {styles.grid}>
            {projects.map((project) => (
                <li key={project.id} className= {styles.card}>
                <Link
                    href={`/projects/${project.id}/files`}
                    className= {styles.projectLink}
                >
                    <strong>{project.name}</strong>
                </Link>
                    {project.owner_id === currentUserId && (
                        <button
                            className= {styles.deleteBtn}
                            onClick={async () => {
                            if (!confirm("Are you sure you want to delete this project?")) return;
                            await deleteProject(project.id);
                            setProjects((prev) => prev.filter((p) => p.id !== project.id));
                            }}
                        >
                            Delete
                        </button>
                        )}
                <input
                    placeholder="Username"
                    value={memberInputs[project.id] || ""}
                    onChange={(e) =>
                        setMemberInputs((prev) => ({
                        ...prev,
                        [project.id]: e.target.value,
                        }))
                    }
                    />
                    <button
                        onClick={async () => {
                            try {
                            await addMember(project.id, memberInputs[project.id]);
                            alert("Member added!");
                            } catch (err: any) {
                            alert(err.message);
                            }
                        }}
                        >
                        Add User
                        </button>
                </li>
            ))}
            </ul>
        </div>
    )
}