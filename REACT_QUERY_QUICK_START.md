# ⚡ React Query Quick Start

**60-Second Guide to React Query in Relay**

---

## 🚀 Quick Commands

```bash
# Start the frontend (React Query already installed)
cd services/relay-client
pnpm dev

# App runs at: http://localhost:5173
```

---

## 📖 Using React Query Hooks

### 1. Fetch Posts

```typescript
import { usePosts } from "./hooks/usePosts";

function HomePage() {
  const { data: posts = [], isLoading, error } = usePosts();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error!</div>;

  return <PostList posts={posts} />;
}
```

---

### 2. Create Post

```typescript
import { useCreatePost } from "./hooks/useCreatePost";

function CreatePostForm() {
  const createPost = useCreatePost();

  const handleSubmit = async () => {
    await createPost.mutateAsync({ title, url });
    // Posts automatically refetched!
  };

  return (
    <button disabled={createPost.isPending}>
      {createPost.isPending ? "Creating..." : "Create"}
    </button>
  );
}
```

---

### 3. Login/Register

```typescript
import { useLogin, useRegister } from "./hooks/useAuth";

function LoginPage() {
  const login = useLogin();
  const register = useRegister();

  const handleLogin = async () => {
    await login.mutateAsync({ email, password });
    // Token automatically stored!
  };
}
```

---

### 4. Upvote (Optimistic)

```typescript
import { useUpvote } from "./hooks/useUpvote";

function UpvoteButton({ postId }) {
  const upvote = useUpvote();

  return (
    <button onClick={() => upvote.mutate(postId)} disabled={upvote.isPending}>
      ▲ Upvote
    </button>
  );
}
```

**Result:** UI updates INSTANTLY, rollback on error

---

## 🎯 Available Hooks

| Hook              | Purpose           | Type                  |
| ----------------- | ----------------- | --------------------- |
| `usePosts()`      | Fetch all posts   | Query                 |
| `useLogin()`      | User login        | Mutation              |
| `useRegister()`   | User registration | Mutation              |
| `useLogout()`     | Logout            | Function              |
| `useCreatePost()` | Create post       | Mutation              |
| `useUpvote()`     | Upvote post       | Mutation (Optimistic) |

---

## 🛠️ React Query DevTools

**How to Open:**

1. Run `pnpm dev`
2. Look for React Query logo in bottom-left corner
3. Click to open

**What You See:**

- All queries (posts, etc.)
- Cache status (fresh/stale/fetching)
- Query data
- Manual refetch button

---

## 🎓 Key Concepts (5-Minute Version)

### 1. Queries (Read Data)

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ["posts"],
  queryFn: fetchPosts,
});
```

### 2. Mutations (Write Data)

```typescript
const mutation = useMutation({
  mutationFn: createPost,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  },
});
```

### 3. Optimistic Updates

```typescript
onMutate: () => {
  // Update UI immediately
},
onError: () => {
  // Rollback on error
},
```

---

## 📁 File Structure

```
services/relay-client/src/
├── lib/
│   ├── queryClient.ts      # QueryClient config
│   └── apiClient.ts         # API utilities
├── hooks/
│   ├── usePosts.ts          # Fetch posts
│   ├── useAuth.ts           # Login/register
│   ├── useCreatePost.ts     # Create post
│   └── useUpvote.ts         # Upvote (optimistic)
├── pages/
│   ├── HomePage.tsx         # Uses all hooks
│   └── LoginPage.tsx        # Uses auth hooks
└── App.tsx                  # QueryClientProvider
```

---

## 🎁 Benefits You Get

✅ **Automatic Caching** - Fewer API calls  
✅ **Optimistic Updates** - Instant UI feedback  
✅ **Auto-Retry** - Network resilience  
✅ **Loading States** - Built-in  
✅ **Error Handling** - Centralized  
✅ **DevTools** - Visual debugging  
✅ **Stale-While-Revalidate** - Instant page loads

---

## 🐛 Common Issues

### Posts Not Refetching After Create?

**Fix:**

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['posts'] });
},
```

### 401 Errors Despite Being Logged In?

**Fix:**

```typescript
// Use createApiClient() for fresh token
const api = createApiClient();
await api.post("/api/posts", data);
```

---

## 📚 Full Documentation

See **REACT_QUERY_IMPLEMENTATION.md** for:

- Complete API reference
- All hooks explained
- Optimistic updates deep-dive
- Configuration options
- Advanced patterns

---

## 🚀 Try It Now

```bash
# 1. Start services
docker compose up -d

# 2. Start frontend
cd services/relay-client
pnpm dev

# 3. Open browser
open http://localhost:5173

# 4. Open DevTools
# Click React Query logo in bottom-left

# 5. Test features
# - Register account
# - Create post
# - Upvote (watch optimistic update!)
# - Check DevTools (see cache, refetch)
```

---

**Result:** Professional state management with minimal code! 🎉
