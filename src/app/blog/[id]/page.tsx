"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Clock, User, ArrowLeft, Tag, Calendar, Share2 } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  author_role: string;
  published_date: string;
  read_time: string;
  category: string;
  image_url: string | null;
}

const normalizeCategory = (s: string) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ");

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

function hasImage(url?: string | null) {
  return typeof url === "string" && url.trim().length > 0;
}

function pickHighlight(title: string) {
  const t = (title || "").trim();
  if (!t) return "PayNow";

  const m = t.match(/"([^"]+)"/);
  if (m?.[1]) return m[1].trim();

  const words = t
    .replace(/[()]/g, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const stop = new Set([
    "how",
    "to",
    "buy",
    "in",
    "on",
    "and",
    "the",
    "a",
    "an",
  ]);
  const meaningful = words.filter((w) => !stop.has(w.toLowerCase()));

  return (
    meaningful.slice(0, 3).join(" ") || words.slice(0, 3).join(" ") || "PayNow"
  );
}

export default function BlogPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [post, setPost] = useState<BlogPost | null>(null);

  const [relatedPosts, setRelatedPosts] = useState<
    Pick<
      BlogPost,
      "id" | "title" | "read_time" | "category" | "image_url" | "published_date"
    >[]
  >([]);

  const [recentPosts, setRecentPosts] = useState<
    Pick<BlogPost, "id" | "title">[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Reply form state (UI only) ----
  const [reply, setReply] = useState({
    comment: "",
    name: "",
    email: "",
    website: "",
    remember: false,
  });

  // Load saved reply fields (always run hook)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("paynow_blog_reply");
      if (!raw) return;
      const saved = JSON.parse(raw);
      setReply((s) => ({
        ...s,
        name: saved?.name || "",
        email: saved?.email || "",
        website: saved?.website || "",
      }));
    } catch {}
  }, []);

  const canSubmitReply =
    reply.comment.trim() &&
    reply.name.trim() &&
    reply.email.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply.email.trim());

  const fetchRecentPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id,title")
      .order("published_date", { ascending: false })
      .limit(8);

    if (!error && data) setRecentPosts(data as any);
  }, []);

  // Fetch post + related + recent
  useEffect(() => {
    if (!id) return;

    const run = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching blog post:", error.message);
        setError("Failed to load blog post. It might not exist.");
        setLoading(false);
        return;
      }

      const found = data as BlogPost;
      setPost(found);

      const categoryKey = normalizeCategory(found.category);

      if (categoryKey) {
        const { data: all, error: relErr } = await supabase
          .from("blog_posts")
          .select("id,title,read_time,category,image_url,published_date")
          .order("published_date", { ascending: false })
          .limit(30);

        if (!relErr && all) {
          const rel = (all as any[])
            .filter(
              (p) =>
                p.id !== found.id &&
                normalizeCategory(p.category) === categoryKey
            )
            .slice(0, 3);

          setRelatedPosts(rel);
        } else {
          setRelatedPosts([]);
        }
      } else {
        setRelatedPosts([]);
      }

      await fetchRecentPosts();
      setLoading(false);
    };

    run();
  }, [id, fetchRecentPosts]);

  // Realtime updates for recent titles
  useEffect(() => {
    const channel = supabase
      .channel("blog_posts_recent_titles_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blog_posts" },
        () => fetchRecentPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecentPosts]);

  const publishedLabel = useMemo(() => {
    if (!post?.published_date) return "";
    return new Date(post.published_date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [post?.published_date]);

  const onPostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitReply) return;

    if (reply.remember) {
      try {
        localStorage.setItem(
          "paynow_blog_reply",
          JSON.stringify({
            name: reply.name.trim(),
            email: reply.email.trim(),
            website: reply.website.trim(),
          })
        );
      } catch {}
    }

    alert("Comment submitted ✅ (UI only for now)");
    setReply((s) => ({ ...s, comment: "" }));
  };

  // ---- EARLY RETURNS ----
  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Invalid post id</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading blog post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Post Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            {error || "The blog post doesn't exist."}
          </p>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 gradient-primary text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const postHasImage = hasImage(post.image_url);
  const postHighlight = pickHighlight(post.title);

  return (
    <div className="py-12 bg-gray-50">
      {/* Back */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <button
          onClick={() => router.push("/blog")}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </button>
      </div>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="bg-white rounded-3xl shadow-lg p-8 md:p-12 mb-8">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <span className="inline-flex items-center gap-1 px-4 py-2 gradient-primary text-white rounded-full text-sm font-semibold shadow-md">
              <Tag className="w-3 h-3" />
              {post.category}
            </span>
            <span className="flex items-center gap-2 text-gray-600 text-sm">
              <Calendar className="w-4 h-4" />
              {publishedLabel}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-gray-600 mb-8">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{post.read_time}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="text-sm">{post.author}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-purple-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-primary-700">
                  {post.author
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{post.author}</p>
                <p className="text-sm text-gray-500">{post.author_role}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                alert("Link copied ✅");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-sm font-medium">Share</span>
            </button>
          </div>
        </header>

        {/* ✅ NO EMPTY SRC: only render <img> when URL is valid */}
        {postHasImage ? (
          <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden shadow-xl mb-8">
            <img
              src={post.image_url!.trim()}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden shadow-xl mb-8 bg-gradient-to-br from-primary-50 via-purple-50 to-white flex items-center justify-center px-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-gray-200 text-gray-700 text-sm font-semibold mb-4">
                <Tag className="w-4 h-4 text-primary-600" />
                {post.category}
              </div>
              <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900">
                {postHighlight}
              </h3>
              <p className="text-gray-600 mt-2">PayNow Blog</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-lg p-8 md:p-12 mb-12">
          <div
            className="prose prose-lg max-w-none
              prose-headings:font-bold prose-headings:text-gray-900
              prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6
              prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4
              prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-6
              prose-ul:my-6 prose-li:text-gray-600 prose-li:mb-2
              prose-strong:text-gray-900 prose-strong:font-semibold"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>

        {/* Related posts: also protect rp.image_url */}
        {relatedPosts.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Related Articles
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((rp) => {
                const rpHasImage = hasImage(rp.image_url);
                const rpHighlight = pickHighlight(rp.title);

                return (
                  <Link
                    key={rp.id}
                    href={`/blog/${rp.id}`}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
                  >
                    {rpHasImage ? (
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={rp.image_url!.trim()}
                          alt={rp.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className="relative h-40 bg-gradient-to-br from-primary-50 via-purple-50 to-white flex items-center justify-center px-4">
                        <p className="text-lg font-extrabold text-gray-900 text-center">
                          {rpHighlight}
                        </p>
                      </div>
                    )}

                    <div className="p-5">
                      <span className="text-xs font-semibold text-primary-600 mb-2 block">
                        {rp.category}
                      </span>
                      <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                        {rp.title}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {rp.read_time}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Leave a Reply */}
        <div className="mb-12 bg-white rounded-3xl shadow-lg p-6 sm:p-8 md:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Leave a Reply
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            your email address will not be published. Required fields are marked
          </p>

          <form onSubmit={onPostComment} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold tracking-widest text-gray-700 mb-2">
                COMMENT*
              </label>
              <textarea
                className={inputClass}
                rows={6}
                value={reply.comment}
                onChange={(e) =>
                  setReply((s) => ({ ...s, comment: e.target.value }))
                }
                placeholder="Write your comment..."
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold tracking-widest text-gray-700 mb-2">
                  NAME*
                </label>
                <input
                  className={inputClass}
                  value={reply.name}
                  onChange={(e) =>
                    setReply((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold tracking-widest text-gray-700 mb-2">
                  EMAIL*
                </label>
                <input
                  className={inputClass}
                  value={reply.email}
                  onChange={(e) =>
                    setReply((s) => ({ ...s, email: e.target.value }))
                  }
                  placeholder="you@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-widest text-gray-700 mb-2">
                WEBSITE
              </label>
              <input
                className={inputClass}
                value={reply.website}
                onChange={(e) =>
                  setReply((s) => ({ ...s, website: e.target.value }))
                }
                placeholder="https://example.com"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={reply.remember}
                onChange={(e) =>
                  setReply((s) => ({ ...s, remember: e.target.checked }))
                }
              />
              <span>
                Save my name, email, and website in this browser for the next
                time i comment.
              </span>
            </label>

            <div className="flex justify-center sm:justify-start">
              <button
                type="submit"
                disabled={!canSubmitReply}
                className="w-full sm:w-auto sm:min-w-[220px] rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-60"
              >
                Post Comment
              </button>
            </div>
          </form>
        </div>

        {/* Recent Posts */}
        <div className="mb-12 bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="px-6 sm:px-8 md:px-12 pt-8">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
              Recent Posts
            </h3>
            <div className="mt-3 h-px w-full bg-gray-200/60" />
          </div>

          <div className="px-6 sm:px-8 md:px-12 pb-8 pt-4">
            {recentPosts.length === 0 ? (
              <p className="text-sm text-gray-500">No recent posts yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100/70">
                {recentPosts.map((p) => (
                  <li key={p.id} className="py-3">
                    <Link
                      href={`/blog/${p.id}`}
                      className="block text-sm sm:text-base text-gray-800 hover:text-primary-600 transition-colors"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* CTA Section */}
        <div className="gradient-primary rounded-3xl p-8 md:p-12 text-center shadow-2xl">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Managing Your Bills Today
          </h2>
          <p className="text-lg text-purple-100 mb-8">
            Pay your electricity, airtime, data, and cable TV bills instantly
            with PayNow
          </p>
          <Link
            href="/"
            className="inline-block bg-white text-primary-700 px-8 py-4 rounded-xl font-bold shadow-xl hover:shadow-white/50 transition-all hover:scale-105"
          >
            Get Started
          </Link>
        </div>
      </article>
    </div>
  );
}
