import React, { useState, useEffect } from "react";
import MDEditor from "@uiw/react-md-editor";
import AdminIndicator from "../../components/AdminIndicator";

const API = "http://127.0.0.1:8000";
const EMPTY = {
  title: "",
  description: "",
  author: "RinkIntel",
  content: "",
  header_image: "",
  published: false
};

function authHeaders() {
  const token = localStorage.getItem("token");
  return token
    ? { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export default function ArticlesAdmin() {
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchArticles() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/articles/all`, { headers: authHeaders() });
      if (!res.ok) {
        console.error("Failed to fetch articles", await res.text());
        setArticles([]);
        setLoading(false);
        return;
      }
      setArticles(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchArticles();
  }, []);

  async function handleSave() {
    const payload = { ...form };
    try {
      if (editId) {
        await fetch(`${API}/articles/${editId}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
      } else {
        await fetch(`${API}/articles`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
      }
      setForm(EMPTY);
      setEditId(null);
      fetchArticles();
    } catch (e) {
      console.error(e);
      alert("Save failed");
    }
  }

  function handleEdit(a) {
    setForm({
      title: a.title,
      description: a.description || "",
      author: a.author || "RinkIntel",
      content: a.content || "",
      header_image: a.header_image || "",
      published: a.published
    });
    setEditId(a.id);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this article?")) return;
    try {
      await fetch(`${API}/articles/${id}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      fetchArticles();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleTogglePublish(a) {
    try {
      await fetch(`${API}/articles/${a.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ ...a, published: !a.published })
      });
      fetchArticles();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ display: "flex", gap: 28 }}>
      <AdminIndicator />

      <div style={{ flex: 1 }}>
        <div className="glass" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>
            {editId ? "Edit Article" : "New Article"}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Title", field: "title" },
              { label: "Description", field: "description" },
              { label: "Author", field: "author" },
              { label: "Header Image URL", field: "header_image" }
            ].map(({ label, field }) => (
              <div key={field}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12 }}>
                  {label}
                </label>
                <input
                  value={form[field]}
                  onChange={e =>
                    setForm(f => ({ ...f, [field]: e.target.value }))
                  }
                  style={{ width: "100%", padding: 10 }}
                />
              </div>
            ))}

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 12 }}>
                Content
              </label>
              <div data-color-mode="dark">
                <MDEditor
                  value={form.content}
                  onChange={val =>
                    setForm(f => ({ ...f, content: val || "" }))
                  }
                  height={360}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="published"
                checked={form.published}
                onChange={e =>
                  setForm(f => ({ ...f, published: e.target.checked }))
                }
              />
              <label htmlFor="published">Published</label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleSave}
                style={{
                  padding: "10px 14px",
                  background: "#ffd700",
                  border: "none",
                  fontWeight: 700
                }}
              >
                {editId ? "Update Article" : "Create Article"}
              </button>

              {editId && (
                <button
                  onClick={() => {
                    setForm(EMPTY);
                    setEditId(null);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: 360 }}>
        <div className="glass" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>All Articles</h3>
          {loading && <div>Loading…</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {articles.map(a => (
              <div
                key={a.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.04)"
                }}
              >
                <div style={{ fontWeight: 700 }}>{a.title}</div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => handleEdit(a)} style={{ flex: 1 }}>
                    Edit
                  </button>

                  <button
                    onClick={() => handleTogglePublish(a)}
                    style={{ flex: 1 }}
                  >
                    {a.published ? "Unpublish" : "Publish"}
                  </button>

                  <button
                    onClick={() => handleDelete(a.id)}
                    style={{ color: "#b91c1c" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {articles.length === 0 && (
              <div style={{ color: "#666" }}>No articles yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
