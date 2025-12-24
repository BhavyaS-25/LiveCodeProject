"use client";

import { create } from "domain";
import { useEffect, useState } from "react";

type Project = {
    id: number;
    name: string;
    owner: number;
};

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newProject, setNewProject] = useState("")
    const [creating, setCreating] = useState(false)

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
                });
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
        <div style = {{padding: 40}}> 
            <h1> My Projects </h1>
            <div style= {{ marginBottom: 20 }}>
                <input placeholder = "New project name"
                value= {newProject}
                onChange = {(e) => setNewProject(e.target.value)}
            />
            <button
                onClick={createProject}
                disabled={creating}
                style={{ marginLeft: 10}}
            >
                {creating ? "Creating..." : "Create Project"}
            </button>
            </div>

            {projects.length === 0 && <p> No projects yet.</p>}
            
            <ul>
                {projects.map((project) => (
                    <li key = {project.id}>
                        {project.name}
                    </li>
                ))}
            </ul>
        </div>
    )
}