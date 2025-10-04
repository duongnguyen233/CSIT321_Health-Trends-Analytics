export default function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
}) {
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition shadow";
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5",
    lg: "px-6 py-3 text-lg",
  };
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    outline: "border border-blue-600 text-blue-600 hover:bg-blue-50",
  };

  return (
    <button onClick={onClick} className={`${base} ${sizes[size]} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}
