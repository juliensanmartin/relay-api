interface Post {
  id: number;
  title: string;
  url: string;
  username: string;
  upvote_count: number;
  created_at: string;
}

interface PostListProps {
  posts: Post[];
  onUpvote: (postId: number) => void;
  isLoggedIn: boolean;
  isUpvoting?: boolean;
}

export default function PostList({
  posts,
  onUpvote,
  isLoggedIn,
  isUpvoting = false,
}: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No posts yet. {isLoggedIn && "Be the first to create one!"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div
          key={post.id}
          className="p-4 bg-white rounded-lg shadow-md flex items-center justify-between"
        >
          <div className="flex items-center w-full">
            <button
              onClick={() => onUpvote(post.id)}
              disabled={isUpvoting}
              className="mr-4 flex flex-col items-center hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isLoggedIn ? "Upvote" : "Login to upvote"}
            >
              <span className="text-2xl">▲</span>
              <span className="font-semibold">{post.upvote_count}</span>
            </button>
            <div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-blue-700 hover:underline"
              >
                {post.title}
              </a>
              <p className="text-sm text-gray-500">
                submitted by {post.username}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
