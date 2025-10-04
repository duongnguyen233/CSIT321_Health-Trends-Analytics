export default function Footer() {
  return (
    <footer className="bg-gray-100 text-gray-600 py-8">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm">&copy; {new Date().getFullYear()} CareData Portal. All rights reserved.</p>
        <div className="flex gap-6 text-sm">
          <a href="/" className="hover:text-gray-900">Privacy</a>
          <a href="/" className="hover:text-gray-900">Terms</a>
          <a href="/" className="hover:text-gray-900">Contact</a>
        </div>
      </div>
    </footer>
  );
}
