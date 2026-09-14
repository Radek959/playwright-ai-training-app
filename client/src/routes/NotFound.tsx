import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Page not found</h1>
      <p className="text-gray-600 mb-6">
        The page you are looking for does not exist, or the address may have a typo.
      </p>
      <div className="flex justify-center gap-4">
        <Link to="/" className="text-indigo-600 hover:underline px-4 py-2 border border-indigo-600 rounded">
          Go to Dashboard
        </Link>
        <Link to="/tasks" className="text-indigo-600 hover:underline px-4 py-2 border border-indigo-600 rounded">
          Go to Tasks
        </Link>
      </div>
    </div>
  );
}
