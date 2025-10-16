export default function ProgressBar({ completed, total }) {
  const percent = (completed / total) * 100;
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>Overall Progress</span>
        <span>{completed} of {total} domains completed</span>
      </div>
      <div className="w-full bg-gray-200 h-3 rounded-full">
        <div
          className="h-3 bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 mt-1">{percent}% complete</p>
    </div>
  );
}
