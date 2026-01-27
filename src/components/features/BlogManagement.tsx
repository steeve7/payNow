"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useSupabaseAuth } from "@/redux/hooks/useSupabaseAuth";

interface BlogPost {
  id: string; // uuid
  title: string;
  excerpt: string;
  content: string;
  author: string;
  author_role: string | null;
  published_date: string; // timestamptz string
  read_time: string | null;
  category: string | null;
  image_url: string | null;
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

  // 1) Access check + initial fetch
  useEffect(() => {
    const run = async () => {
      if (authLoading) return;

      // Not logged in -> go home
      if (!user) {
        router.push("/");
        return;
      }

      try {
        // /api/users/me should return { role: "super_admin" | "blog_manager" | ... }
        const meRes = await fetch("/api/users/me", { cache: "no-store" });
        const me = await meRes.json();

        const role = me?.role ?? null;
        setAdminRole(role);

        // only allow blog page for super_admin/blog_manager
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
      const res = await fetch(`/api/admin/blog-posts?t=${Date.now()}`, {
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

    // published_date: use YYYY-MM-DD for the input (we’ll convert in API)
    const today = new Date().toISOString().slice(0, 10);

    setFormState({
      title: "",
      excerpt: "",
      content: "",
      author: "",
      author_role: "",
      published_date: today,
      read_time: "5 min read",
      category: "",
      image_url: "",
    });

    setImagePreview(null);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = async (postId: string) => {
    try {
      setError(null);

      const res = await fetch(
        `/api/admin/blog-posts/${postId}?t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Failed to fetch blog post");

      const post: BlogPost = out.post;

      // convert timestamptz -> YYYY-MM-DD for <input type="date">
      const dateOnly = post.published_date
        ? new Date(post.published_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      setEditingPost(post);
      setFormState({ ...post, published_date: dateOnly });
      setImagePreview(post.image_url || null);
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
    setError(null);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  // Uploads image to storage bucket via API, then stores public URL in image_url
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
      // IMPORTANT: API expects "image"
      fd.append("image", file);

      const res = await fetch("/api/admin/blog-posts/upload-image", {
        method: "POST",
        body: fd,
      });

      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Failed to upload image");

      // API returns { imageUrl }
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
        ? `/api/admin/blog-posts/${editingPost.id}`
        : "/api/admin/blog-posts";

      // Send DB column names exactly
      const payload = {
        title: formState.title,
        excerpt: formState.excerpt,
        content: formState.content,
        author: formState.author,
        author_role: formState.author_role || "",
        // published_date coming from <input type="date"> as YYYY-MM-DD
        // server will convert to timestamptz
        published_date: formState.published_date,
        read_time: formState.read_time || "5 min read",
        category: formState.category || "",
        image_url: formState.image_url || "",
      };

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
      const res = await fetch(`/api/admin/blog-posts/${postId}`, {
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
        <div className="flex justify-between items-center mb-8">
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
            className="inline-flex items-center gap-2 gradient-primary text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <PlusCircle className="w-5 h-5" />
            New Post
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}

        <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
          {blogPosts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Author
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Published Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {blogPosts.map((post) => (
                    <tr
                      key={post.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <div className="max-w-xs">
                          <p className="truncate">{post.title}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {post.author}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
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
                          className="text-primary-600 hover:text-primary-900 mr-4 inline-flex items-center"
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
            <div className="p-8 text-center text-gray-500">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No blog posts yet</p>
              <p className="text-sm">
                Click "New Post" to create your first blog post.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
          <div className="relative p-8 bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 my-8">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                {editingPost ? "Edit Blog Post" : "Create New Blog Post"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formState.title || ""}
                  onChange={handleFormChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Excerpt *
                </label>
                <textarea
                  name="excerpt"
                  value={formState.excerpt || ""}
                  onChange={handleFormChange}
                  required
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Content (HTML allowed) *
                </label>
                <textarea
                  name="content"
                  value={formState.content || ""}
                  onChange={handleFormChange}
                  required
                  rows={12}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Author *
                  </label>
                  <input
                    type="text"
                    name="author"
                    value={formState.author || ""}
                    onChange={handleFormChange}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Author Role
                  </label>
                  <input
                    type="text"
                    name="author_role"
                    value={formState.author_role || ""}
                    onChange={handleFormChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Published Date *
                  </label>
                  <input
                    type="date"
                    name="published_date"
                    value={formState.published_date || ""}
                    onChange={handleFormChange}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Read Time
                  </label>
                  <input
                    type="text"
                    name="read_time"
                    value={formState.read_time || ""}
                    onChange={handleFormChange}
                    placeholder="e.g., 5 min read"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <input
                  type="text"
                  name="category"
                  value={formState.category || ""}
                  onChange={handleFormChange}
                  placeholder="e.g., Cable TV"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Blog Post Image
                </label>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="image_upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
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

                    <p className="mt-1 text-xs text-gray-500">Max size: 5MB</p>
                  </div>

                  {imagePreview && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <ImageIcon className="w-5 h-5 text-gray-400 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 mb-2">
                            Preview
                          </p>
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-lg border border-gray-200"
                            onError={() => setImagePreview(null)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center px-6 py-2 text-sm font-medium text-white gradient-primary rounded-md disabled:opacity-50"
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
