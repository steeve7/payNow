"use client";

import Link from "next/link";
import { Clock, User, ArrowRight, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  author_role: string;
  published_date: string;
  read_time: string;
  category: string;
  image_url: string | null;
}

const normalizeCategory = (s: string) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ");

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

export default function BlogPage() {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    const fetchBlogPosts = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("blog_posts")
        .select(
          "id,title,excerpt,author,author_role,published_date,read_time,category,image_url"
        )
        .order("published_date", { ascending: false });

      if (error) {
        console.error("Error fetching blog posts:", error.message);
        setError("Failed to load blog posts. Please try again later.");
        setLoading(false);
        return;
      }

      setBlogPosts((data as BlogPost[]) || []);
      setLoading(false);
    };

    fetchBlogPosts();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, string>();

    for (const post of blogPosts) {
      const raw = post.category || "";
      const key = normalizeCategory(raw);
      if (!key) continue;
      if (!map.has(key)) map.set(key, raw.trim());
    }

    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [blogPosts]);

  const filteredPosts = useMemo(() => {
    if (selectedCategory === "all") return blogPosts;
    return blogPosts.filter(
      (p) => normalizeCategory(p.category) === selectedCategory
    );
  }, [blogPosts, selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading blog posts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-20 bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-50 via-purple-50 to-white py-20 mb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              PayNow Blog
            </span>
          </h1>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Tips, guides, and insights to help you manage your bills and
            finances better
          </p>

          {/* Categories */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium shadow-md hover:shadow-lg transition-all ${
                selectedCategory === "all"
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-primary-300"
              }`}
            >
              All Posts
            </button>

            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium shadow-sm hover:shadow-md transition-all ${
                  selectedCategory === c.key
                    ? "bg-primary-600 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-primary-300"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {filteredPosts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => {
              const postHasImage = hasImage(post.image_url);
              const highlight = pickHighlight(post.title);

              return (
                <article
                  key={post.id}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  {/* ✅ Image OR fallback (never empty src) */}
                  {postHasImage ? (
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={post.image_url!.trim()}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-primary-700">
                          <Tag className="w-3 h-3" />
                          {post.category}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-48 bg-gradient-to-br from-primary-50 via-purple-50 to-white flex items-center justify-center px-6">
                      <div className="text-center">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-primary-700 border border-gray-200">
                          <Tag className="w-3 h-3" />
                          {post.category || "PayNow"}
                        </div>
                        <h3 className="mt-3 text-xl font-extrabold text-gray-900">
                          {highlight}
                        </h3>
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {post.read_time}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {post.author}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-primary-600 transition-colors">
                      {post.title}
                    </h2>

                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>

                    <Link
                      href={`/blog/${post.id}`}
                      className="inline-flex items-center gap-2 text-primary-600 font-semibold hover:gap-3 transition-all group-hover:text-primary-700"
                    >
                      Read More
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Footer */}
                  <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-700">
                          {(post.author || "")
                            .split(" ")
                            .filter(Boolean)
                            .map((n) => n[0])
                            .join("") || "PN"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {post.author}
                        </p>
                        <p className="text-xs text-gray-500">
                          {post.author_role}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            No blog posts found
            {selectedCategory !== "all" ? " for the selected category" : ""}.
          </div>
        )}
      </div>

      {/* Newsletter CTA */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="gradient-primary rounded-3xl p-12 text-center shadow-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Subscribe to Our Newsletter
          </h2>
          <p className="text-lg text-purple-100 mb-8 max-w-2xl mx-auto">
            Get the latest tips, guides, and updates delivered straight to your
            inbox
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-4 rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:border-white focus:ring-2 focus:ring-white/20 outline-none transition-all"
            />
            <button className="bg-white text-primary-700 px-8 py-4 rounded-xl font-bold shadow-xl hover:shadow-white/50 transition-all hover:scale-105 whitespace-nowrap">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
