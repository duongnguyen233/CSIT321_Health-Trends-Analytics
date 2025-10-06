import { useState, useEffect } from "react";
import { ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/solid";

export default function DomainCard({ id, title, description, open, onToggle, fields }) {
  const [status, setStatus] = useState("Not Started");
  const [formData, setFormData] = useState({});

  const handleChange = (fieldLabel, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldLabel]: value,
    }));
  };

  // Treat fields as required unless explicitly required === false
  const isRequired = (f) => f.required !== false;

  // Render label with red * for required; if legacy labels contain '*', strip trailing * first
  const renderLabel = (label, required) => {
    const clean = String(label).replace(/\s*\*+$/, "");
    return (
      <>
        {clean}
        {required && <span className="text-red-600"> *</span>}
      </>
    );
  };

  useEffect(() => {
    const requiredFields = fields.filter(isRequired);
    const anyTouched = Object.keys(formData).length > 0;

    const allRequiredFilled = requiredFields.every((f) => {
      const v = formData[f.label];
      return v !== undefined && String(v).trim() !== "";
    });

    if (allRequiredFilled && (anyTouched || requiredFields.length > 0)) {
      setStatus("Completed");
    } else if (anyTouched) {
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
          {fields.map((field, i) => {
            const required = isRequired(field);
            const val = formData[field.label] || "";

            return (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {renderLabel(field.label, required)}
                </label>

                {field.type === "textarea" ? (
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-gray-300"
                    rows={3}
                    value={val}
                    onChange={(e) => handleChange(field.label, e.target.value)}
                    placeholder={required ? "Required" : "Optional"}
                  />
                ) : (
                  <input
                    type={field.type}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-gray-300"
                    value={val}
                    onChange={(e) => handleChange(field.label, e.target.value)}
                    placeholder={required ? "Required" : "Optional"}
                  />
                )}

                {field.type === "number" && (
                  <p className="text-xs text-gray-400 mt-1">Minimum: 0</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
