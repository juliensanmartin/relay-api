import { Link } from "react-router-dom";

interface HeaderProps {
  isLoggedIn: boolean;
  onLogout: () => void;
}

export default function Header({ isLoggedIn, onLogout }: HeaderProps) {
  return (
    <header className="flex justify-between items-center mb-6 pb-4 border-b">
      <Link to="/">
        <h1 className="text-3xl font-bold text-gray-800 hover:text-gray-600 transition-colors">
          Relay
        </h1>
      </Link>
      <div>
        {isLoggedIn ? (
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            Logout
          </button>
        ) : (
          <Link
            to="/login"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded inline-block"
          >
            Login / Register
          </Link>
        )}
      </div>
    </header>
  );
}
