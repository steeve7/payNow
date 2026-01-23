export const canAccessDashboard = (role?: string) =>
  role === "super_admin" || role === "manager";

export const canAccessBlog = (role?: string) =>
  role === "super_admin" || role === "blog_manager";

export const canAccessContactSubmissions = (role?: string) =>
  role === "super_admin" || role === "manager" || role === "customer_support";

export const isSuperAdmin = (role?: string) => role === "super_admin";
