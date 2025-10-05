import { useState, useEffect } from "react";
import { ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/solid";

export default function DomainCard({ id, title, description, open, onToggle, fields }) {
  const [status, setStatus] = useState("Not Started");
  const [formData, setFormData] = useState({});

  // Handle input change
  const handleChange = (fieldLabel, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldLabel]: value,
    }));
  };

  // Update status dynamically
  useEffect(() => {
    const allFieldsFilled = fields.every((f) => {
      const value = formData[f.label];
      return value && value.trim() !== "";
    });

    if (allFieldsFilled && Object.keys(formData).length > 0) {
      setStatus("Completed");
    } else if (Object.keys(formData).length > 0) {
      setStatus("In Progress");
    } else {
      setStatus("Not Started");
    }
  }, [formData, fields]);

  return (
    <div className="border rounded-lg shadow-sm p-5 bg-white transition-all duration-200">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={onToggle}
      >
        <div>
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium px-3 py-1 rounded-full border flex items-center gap-1 ${
              status === "Completed"
                ? "bg-green-100 text-green-700 border-green-400"
                : status === "In Progress"
                ? "bg-yellow-100 text-yellow-700 border-yellow-400"
                : "bg-gray-100 text-gray-700 border-gray-300"
            }`}
          >
            {status}
            {open ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-500 transition-transform duration-200" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-500 transition-transform duration-200" />
            )}
          </span>
        </div>
      </div>

      {/* Collapsible content */}
      {open && (
        <div className="mt-4 space-y-4">
          {fields.map((field, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-gray-300"
                  rows={3}
                  value={formData[field.label] || ""}
                  onChange={(e) => handleChange(field.label, e.target.value)}
                />
              ) : (
                <input
                  type={field.type}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-gray-300"
                  value={formData[field.label] || ""}
                  onChange={(e) => handleChange(field.label, e.target.value)}
                />
              )}
              {field.type === "number" && (
                <p className="text-xs text-gray-400 mt-1">Minimum: 0</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
