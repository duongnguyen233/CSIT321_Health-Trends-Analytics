export default function ListItem({ step, title, desc }) {
  return (
    <div className="flex items-start gap-4">
      {/* Step Number */}
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold">
        {step}
      </div>

      {/* Text */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        <p className="text-gray-600">{desc}</p>
      </div>
    </div>
  );
}
