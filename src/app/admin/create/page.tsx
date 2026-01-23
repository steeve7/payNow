"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { uploadBlogImage } from "@/lib/uploadBlogImage";

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

type Msg =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

export default function CreateBlogPage() {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const [author, setAuthor] = useState("PayNow Team");
  const [authorRole, setAuthorRole] = useState("Editor");
  const [readTime, setReadTime] = useState("5 min read");

  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setMsg(null);
      setUploading(true);
      const url = await uploadBlogImage(file);
      setImageUrl(url);
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const cleanCategory = category.trim();

    if (!title.trim() || !excerpt.trim() || !content.trim() || !cleanCategory) {
      setMsg({
        type: "error",
        text: "Please fill: title, excerpt, content, category.",
      });
      return;
    }

    if (!imageUrl) {
      setMsg({ type: "error", text: "Please upload a featured image first." });
      return;
    }

    setSaving(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error("You must be logged in as admin.");
      }

      const res = await fetch("/api/admin/blog_posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          excerpt: excerpt.trim(),
          content, // keep as-is because it's HTML
          category: cleanCategory,
          author: author.trim(),
          author_role: authorRole.trim(),
          read_time: readTime.trim(),
          image_url: imageUrl,
        }),
      });

      const raw = await res.text();

      let out: any = null;
      try {
        out = JSON.parse(raw);
      } catch {
        // raw might be HTML or plain text
      }

      if (!res.ok) {
        throw new Error(out?.error || raw || "Request failed");
      }

      setMsg({ type: "success", text: "Blog post created successfully ✅" });

      // clear form fields (leave author fields if you want, but I'll keep them)
      setTitle("");
      setExcerpt("");
      setContent("");
      setCategory("");
      setImageUrl("");
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "Failed to create post" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">Create Blog Post</h1>

      {msg && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            msg.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-5">
        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Featured Image
          </label>
          <input type="file" accept="image/*" onChange={onFileChange} />

          {uploading && (
            <p className="text-sm text-gray-500 mt-2">Uploading image…</p>
          )}

          {imageUrl && (
            <img
              src={imageUrl}
              alt="Preview"
              className="mt-4 rounded-lg border w-full"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Excerpt</label>
          <textarea
            className={inputClass}
            rows={3}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <input
            className={inputClass}
            placeholder='e.g. "Cable TV"'
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Tip: category is case-insensitive on the blog page now.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Content (HTML allowed)
          </label>
          <textarea
            className={inputClass}
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-2">Author</label>
            <input
              className={inputClass}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Author Role
            </label>
            <input
              className={inputClass}
              value={authorRole}
              onChange={(e) => setAuthorRole(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Read Time</label>
            <input
              className={inputClass}
              value={readTime}
              onChange={(e) => setReadTime(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || uploading}
          className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create Post"}
        </button>
      </form>
    </div>
  );
}
