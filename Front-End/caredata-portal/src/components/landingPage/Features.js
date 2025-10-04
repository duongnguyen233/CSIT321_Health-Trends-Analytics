import Card from "../common/Card";

export default function Features() {
  const items = [
    { icon: "📄", title: "Easy Upload", desc: "Upload CSV or Excel files quickly in the required format." },
    { icon: "🔒", title: "Secure & Compliant", desc: "Data validation ensures compliance with government standards." },
    { icon: "📊", title: "Analytics", desc: "Track submissions and generate insights instantly." },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Key Features
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {items.map((item, idx) => (
            <Card key={idx} title={
              <div className="flex flex-col items-center">
                <div className="text-4xl mb-3">{item.icon}</div>
                {item.title}
              </div>
            }>
              {item.desc}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
