"use client";

export default function InfoTipsPage() {
  return (
    <div className="p-6 min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-bold text-indigo-700 mb-4">
        📌 Info Tips Spartan
      </h1>
      <p className="text-gray-600 text-sm mb-6">
        Accede a las recomendaciones, tips y novedades comerciales actualizadas.
      </p>

      <div className="w-full h-[85vh] rounded-xl overflow-hidden shadow-lg border">
        <iframe
          src="https://docs.google.com/spreadsheets/d/1ptiFORLDtMDqtn1yVGDKZsidVVu4uJn1/preview?usp=sharing"
          className="w-full h-full"
          allowFullScreen
        />
      </div>
    </div>
  );
}
