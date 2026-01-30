import { useEffect, useState } from "react";
import { BookOpen, FileText, Tag, Calendar } from "lucide-react";
import Link from "next/link";

interface BlogPost {
  id: string;
  title: string;
  category: string;
  published_date: string;
  author: string;
}

interface BlogStats {
  totalPosts: number;
  categories: { category: string; count: number }[];
  recentPosts: BlogPost[];
}

export default function BlogAnalytics() {
  const [stats, setStats] = useState<BlogStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlogStats = async () => {
      try {
        const response = await fetch("/api/admin/blog_posts", {
          credentials: "include",
        });
        if (response.ok) {
          const posts: BlogPost[] = await response.json();

          // Calculate statistics
          const categoryMap = new Map<string, number>();
          posts.forEach((post) => {
            if (post.category) {
              categoryMap.set(
                post.category,
                (categoryMap.get(post.category) || 0) + 1
              );
            }
          });

          const categories = Array.from(categoryMap.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);

          const recentPosts = posts
            .sort(
              (a, b) =>
                new Date(b.published_date).getTime() -
                new Date(a.published_date).getTime()
            )
            .slice(0, 5);

          setStats({
            totalPosts: posts.length,
            categories,
            recentPosts,
          });
        }
      } catch (error) {
        console.error("Error fetching blog stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Blog Analytics</h3>
            <p className="text-sm text-gray-600">
              Content performance and statistics
            </p>
          </div>
        </div>
        <Link
          href="/admin/blog-management"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          Manage Posts
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Total Posts
            </span>
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalPosts}</p>
          <p className="text-xs text-gray-500 mt-1">Published blog posts</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Categories
            </span>
            <Tag className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {stats.categories.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Unique categories</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Latest Post
            </span>
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">
            {stats.recentPosts[0]
              ? new Date(
                  stats.recentPosts[0].published_date
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "N/A"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Most recent publication</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Posts */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Recent Posts
          </h4>
          <div className="space-y-2">
            {stats.recentPosts.length > 0 ? (
              stats.recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">
                    {post.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {new Date(post.published_date).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{post.author}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">
                No posts yet
              </p>
            )}
          </div>
        </div>

        {/* Categories */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Posts by Category
          </h4>
          <div className="space-y-2">
            {stats.categories.length > 0 ? (
              stats.categories.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {cat.category}
                  </span>
                  <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-semibold">
                    {cat.count} {cat.count === 1 ? "post" : "posts"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">
                No categories yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
