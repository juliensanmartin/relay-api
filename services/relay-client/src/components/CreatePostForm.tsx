import { useState, type FormEvent } from "react";

interface CreatePostFormProps {
  onCreate: (title: string, url: string) => void;
}

export default function CreatePostForm({ onCreate }: CreatePostFormProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onCreate(title, url);
    setTitle("");
    setUrl("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 p-4 bg-gray-50 rounded-lg shadow"
    >
      <h3 className="text-xl font-semibold mb-4">Create a New Post</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="w-full px-4 py-2 border rounded-md"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL"
          required
          className="w-full px-4 py-2 border rounded-md"
        />
        <button
          type="submit"
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md"
        >
          Submit Post
        </button>
      </div>
    </form>
  );
}
