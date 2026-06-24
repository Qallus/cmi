import { loadBlogPosts } from "@/lib/blog/data";
import { BlogClient } from "./blog-client";

export const metadata = { title: "Blog — CMI Dashboard" };

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  try {
    const posts = await loadBlogPosts();
    return <BlogClient initialPosts={posts} />;
  } catch {
    return <BlogClient initialPosts={[]} />;
  }
}
