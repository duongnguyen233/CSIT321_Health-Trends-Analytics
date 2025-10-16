export default function Card({ title, children }) {
  return (
    <div className="p-6 border rounded-xl shadow-sm hover:shadow-lg transition">
      {title && <h3 className="text-xl font-semibold mb-3 text-gray-900">{title}</h3>}
      <div className="text-gray-600">{children}</div>
    </div>
  );
}
