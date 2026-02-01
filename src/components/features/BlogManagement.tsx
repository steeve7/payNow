"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusCircle,
  Edit,
  Trash2,
  Loader2,
  BookOpen,
  X,
  Lock,
  Upload,
  Image as ImageIcon,
  Bold,
  Underline,
  Link as LinkIcon,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Eye,
} from "lucide-react";
import { useSupabaseAuth } from "@/redux/hooks/useSupabaseAuth";

interface BlogPost {
  id: string; // uuid
  title: string;
  excerpt: string;
  content: string; // HTML string
  author: string;
  author_role: string | null;
  published_date: string; // timestamptz
  read_time: string | null;
  category: string | null;
  image_url: string | null;
}

const CATEGORIES = [
  "Airtime",
  "Internet Data",
  "Education",
  "Electricity",
  "Showmax",
  "Cable TV",
  "International Airtime",
] as const;

type Category = (typeof CATEGORIES)[number];

function safeStr(v: any) {
  return typeof v === "string" ? v : "";
}

/**
 * Pick a “highlight” phrase from the title, like "Electricity Tokens".
 * Strategy:
 * 1) If title contains any known keywords, prefer that 2-word phrase.
 * 2) Else pick first 2–3 meaningful words (skipping stopwords).
 */
function pickTitleHighlight(title: string) {
  const t = safeStr(title).trim();
  if (!t) return "PayNow";

  const lower = t.toLowerCase();

  const keywords = [
    "electricity",
    "token",
    "tokens",
    "airtime",
    "data",
    "education",
    "showmax",
    "cable",
    "tv",
    "international",
  ];

  // try to find best 2-word phrase around a keyword
  const words = t
    .replace(/[()]/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const lowerWords = words.map((w) => w.toLowerCase());

  for (let i = 0; i < lowerWords.length; i++) {
    if (keywords.includes(lowerWords[i])) {
      // prefer (word + next) if exists, else (prev + word)
      const a = words[i];
      const b = words[i + 1];
      if (b) return `${a} ${b}`;
      const p = words[i - 1];
      if (p) return `${p} ${a}`;
      return a;
    }
  }

  // fallback: first 2–3 meaningful words
  const stop = new Set([
    "how",
    "to",
    "buy",
    "online",
    "in",
    "n",
    "nigeria",
    "fast",
    "secure",
    "and",
    "or",
    "the",
    "a",
    "an",
    "for",
    "with",
    "your",
    "on",
    "at",
    "of",
  ]);

  const meaningful = words.filter((w) => {
    const lw = w.toLowerCase();
    return lw.length >= 3 && !stop.has(lw);
  });

  const pick = meaningful.slice(0, 3).join(" ");
  return pick || words.slice(0, 2).join(" ") || "PayNow";
}

function Thumbnail({
  title,
  image_url,
}: {
  title: string;
  image_url?: string | null;
}) {
  const highlight = useMemo(() => pickTitleHighlight(title), [title]);

  if (image_url) {
    return (
      <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        <img
          src={image_url}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // pretty placeholder “cover”
  return (
    <div className="w-14 h-14 rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center px-2">
      <span className="text-[10px] leading-[12px] font-semibold text-white text-center line-clamp-3">
        {highlight}
      </span>
    </div>
  );
}

/**
 * Minimal rich text editor using contentEditable + execCommand.
 * Stores HTML in `value`.
 */
function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const exec = (command: string, val?: string) => {
    // NOTE: execCommand is deprecated but still works across browsers.
    document.execCommand(command, false, val);
    // sync HTML after command
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const onInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const setLink = () => {
    const url = prompt("Enter URL (https://...)");
    if (!url) return;
    exec("createLink", url);
  };

  // keep editor in sync when value changes (edit mode load)
  useEffect(() => {
    if (!ref.current) return;
    // only update if different to avoid cursor jump
    if (ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  return (
    <div className="rounded-xl border border-gray-300 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-gray-50 px-2 py-2">
        <button
          type="button"
          onClick={() => exec("bold")}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
          title="Bold"
        >
          <Bold className="w-4 h-4" /> Bold
        </button>

        <button
          type="button"
          onClick={() => exec("underline")}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
          title="Underline"
        >
          <Underline className="w-4 h-4" /> Underline
        </button>

        <button
          type="button"
          onClick={setLink}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
          title="Insert link"
        >
          <LinkIcon className="w-4 h-4" /> Link
        </button>

        <span className="mx-1 h-5 w-px bg-gray-200" />

        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
          title="Bulleted list"
        >
          <List className="w-4 h-4" /> Bullet
        </button>

        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" /> Number
        </button>

        <span className="mx-1 h-5 w-px bg-gray-200" />

        <button
          type="button"
          onClick={() => exec("outdent")}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
          title="Outdent"
        >
          <Outdent className="w-4 h-4" /> Outdent
        </button>

        <button
          type="button"
          onClick={() => exec("indent")}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
          title="Indent"
        >
          <Indent className="w-4 h-4" /> Indent
        </button>

        <span className="mx-1 h-5 w-px bg-gray-200" />

        <button
          type="button"
          onClick={() => exec("formatBlock", "p")}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
          title="Paragraph"
        >
          ¶ Paragraph
        </button>
      </div>

      {/* Editor */}
      <div
        ref={ref}
        contentEditable
        onInput={onInput}
        className="min-h-[260px] p-3 text-sm outline-none"
        // allow Enter to create paragraphs naturally
        suppressContentEditableWarning
      />

      <div className="border-t bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
        Tip: use Enter for new paragraphs. You can paste content too.
      </div>
    </div>
  );
}

export default function BlogManagement() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();

  const [adminRole, setAdminRole] = useState<string | null>(null);

  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const [formState, setFormState] = useState<Partial<BlogPost>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [showPreview, setShowPreview] = useState(false);

  // 1) Access check + initial fetch
  useEffect(() => {
    const run = async () => {
      if (authLoading) return;

      if (!user) {
        router.push("/");
        return;
      }

      try {
        const meRes = await fetch("/api/users/me", { cache: "no-store" });
        const me = await meRes.json();

        const role = me?.role ?? null;
        setAdminRole(role);

        if (role !== "super_admin" && role !== "blog_manager") {
          router.push("/");
          return;
        }

        await fetchBlogPosts();
      } catch (e: any) {
        console.error(e);
        router.push("/");
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const fetchBlogPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blog_posts?t=${Date.now()}`, {
        cache: "no-store",
      });

      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Failed to fetch blog posts");

      setBlogPosts(out.posts || []);
    } catch (err: any) {
      console.error("fetchBlogPosts error:", err);
      setError(err.message || "Failed to load blog posts.");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPost(null);
    const today = new Date().toISOString().slice(0, 10);

    setFormState({
      title: "",
      excerpt: "",
      content: "", // HTML
      author: "",
      author_role: "",
      published_date: today,
      read_time: "5 min read",
      category: "Airtime",
      image_url: "",
    });

    setImagePreview(null);
    setShowPreview(false);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = async (postId: string) => {
    try {
      setError(null);

      const res = await fetch(
        `/api/admin/blog_posts/${postId}?t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Failed to fetch blog post");

      const post: BlogPost = out.post;

      const dateOnly = post.published_date
        ? new Date(post.published_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      setEditingPost(post);
      setFormState({ ...post, published_date: dateOnly });
      setImagePreview(post.image_url || null);
      setShowPreview(false);
      setShowModal(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not load post for editing.");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPost(null);
    setFormState({});
    setImagePreview(null);
    setShowPreview(false);
    setError(null);
  };

  const handleTextChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (val: string) => {
    setFormState((prev) => ({ ...prev, category: val }));
  };

  const handleContentChange = (html: string) => {
    setFormState((prev) => ({ ...prev, content: html }));
  };

  // Upload image to storage bucket via API, then store public URL
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowed.includes(file.type)) {
      setError(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed"
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Max size is 5MB");
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("image", file);

      const res = await fetch("/api/admin/blog_posts/upload-image", {
        method: "POST",
        body: fd,
      });

      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Failed to upload image");

      setFormState((prev) => ({ ...prev, image_url: out.imageUrl }));
      setImagePreview(out.imageUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const method = editingPost ? "PUT" : "POST";
      const url = editingPost
        ? `/api/admin/blog_posts/${editingPost.id}`
        : "/api/admin/blog_posts";

      const payload = {
        title: safeStr(formState.title),
        excerpt: safeStr(formState.excerpt),
        content: safeStr(formState.content), // HTML
        author: safeStr(formState.author),
        author_role: safeStr(formState.author_role),
        published_date: formState.published_date,
        read_time: safeStr(formState.read_time) || "5 min read",
        category: safeStr(formState.category),
        image_url: safeStr(formState.image_url),
      };

      if (
        !payload.title ||
        !payload.excerpt ||
        !payload.content ||
        !payload.author
      ) {
        throw new Error("Please fill Title, Excerpt, Content and Author.");
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Failed to save post");

      closeModal();
      await fetchBlogPosts();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this blog post?")) return;

    try {
      const res = await fetch(`/api/admin/blog_posts/${postId}`, {
        method: "DELETE",
      });

      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Failed to delete post");

      await fetchBlogPosts();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to delete blog post.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading blog management...</p>
        </div>
      </div>
    );
  }

  if (
    !adminRole ||
    (adminRole !== "super_admin" && adminRole !== "blog_manager")
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">
            You don't have permission to access blog management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Blog Post Management
            </h1>
            <p className="text-gray-600 mt-1">
              Create, edit, and manage your blog content
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow hover:bg-indigo-700 transition"
          >
            <PlusCircle className="w-5 h-5" />
            New Post
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* List */}
        <div className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200">
          {blogPosts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Author
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Published
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100">
                  {blogPosts.map((post) => (
                    <tr
                      key={post.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Thumbnail
                            title={post.title}
                            image_url={post.image_url}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[420px]">
                              {post.title}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-[420px] mt-0.5">
                              {post.excerpt}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="font-medium">{post.author}</div>
                        <div className="text-xs text-gray-500">
                          {post.author_role || ""}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                          {post.category || "-"}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {post.published_date
                          ? new Date(post.published_date).toLocaleDateString()
                          : "-"}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {/* Preview */}
                        <Link
                          href={`/blog/${post.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 mr-4 inline-flex items-center"
                          title="Preview Post"
                        >
                          <BookOpen className="w-4 h-4" />
                        </Link>

                        {/* Edit */}
                        <button
                          onClick={() => openEditModal(post.id)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4 inline-flex items-center"
                          title="Edit Post"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="text-red-600 hover:text-red-900 inline-flex items-center"
                          title="Delete Post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-gray-500">
              <BookOpen className="w-14 h-14 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-semibold mb-1">No blog posts yet</p>
              <p className="text-sm">
                Click “New Post” to create your first blog post.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10 px-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-6 border border-gray-200">
            <div className="flex justify-between items-start px-6 py-5 border-b">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {editingPost ? "Edit Blog Post" : "Create New Blog Post"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Use the editor to format your content (bold, underline, links,
                  lists, indentation).
                </p>
              </div>

              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: fields */}
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">
                      Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={safeStr(formState.title)}
                      onChange={handleTextChange}
                      required
                      className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700">
                      Excerpt *
                    </label>
                    <textarea
                      name="excerpt"
                      value={safeStr(formState.excerpt)}
                      onChange={handleTextChange}
                      required
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        Content *
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowPreview((s) => !s)}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                        {showPreview ? "Hide preview" : "Show preview"}
                      </button>
                    </div>

                    <RichTextEditor
                      value={safeStr(formState.content)}
                      onChange={handleContentChange}
                    />

                    {showPreview && (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          Preview (renders HTML)
                        </p>
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: safeStr(formState.content),
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: meta + image */}
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-bold text-gray-900 mb-3">
                      Post settings
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600">
                          Category
                        </label>
                        <select
                          value={safeStr(formState.category) || "Airtime"}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-sm"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600">
                            Published Date *
                          </label>
                          <input
                            type="date"
                            name="published_date"
                            value={safeStr(formState.published_date)}
                            onChange={handleTextChange}
                            required
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600">
                            Read Time
                          </label>
                          <input
                            type="text"
                            name="read_time"
                            value={safeStr(formState.read_time) || "5 min read"}
                            onChange={handleTextChange}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-sm"
                            placeholder="e.g., 5 min read"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600">
                          Author *
                        </label>
                        <input
                          type="text"
                          name="author"
                          value={safeStr(formState.author)}
                          onChange={handleTextChange}
                          required
                          className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600">
                          Author Role
                        </label>
                        <input
                          type="text"
                          name="author_role"
                          value={safeStr(formState.author_role)}
                          onChange={handleTextChange}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-bold text-gray-900 mb-3">
                      Thumbnail
                    </p>

                    <div className="flex items-center gap-3">
                      <Thumbnail
                        title={safeStr(formState.title)}
                        image_url={imagePreview || safeStr(formState.image_url)}
                      />

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          If you don’t upload an image, we’ll show a title
                          highlight.
                        </p>
                        <p className="text-xs font-semibold text-gray-700 mt-1 line-clamp-2">
                          {pickTitleHighlight(safeStr(formState.title))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <label
                        htmlFor="image_upload"
                        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 text-sm font-semibold"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Upload Image
                          </>
                        )}
                      </label>

                      <input
                        type="file"
                        id="image_upload"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />

                      <p className="text-xs text-gray-500">Max size: 5MB</p>

                      {(imagePreview || safeStr(formState.image_url)) && (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-start gap-3">
                            <ImageIcon className="w-5 h-5 text-gray-400 mt-1" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 mb-2">
                                Preview
                              </p>
                              <img
                                src={
                                  imagePreview || safeStr(formState.image_url)
                                }
                                alt="Preview"
                                className="w-full h-40 object-cover rounded-lg border border-gray-200"
                                onError={() => setImagePreview(null)}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setImagePreview(null);
                                  setFormState((p) => ({
                                    ...p,
                                    image_url: "",
                                  }));
                                }}
                                className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
                              >
                                Remove image
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {editingPost ? "Updating..." : "Creating..."}
                        </>
                      ) : editingPost ? (
                        "Update Post"
                      ) : (
                        "Create Post"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className="px-6 pb-6 text-[11px] text-gray-500">
              Note: content is stored as HTML. When rendering on your public
              blog page, render it safely (you already allow HTML).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
