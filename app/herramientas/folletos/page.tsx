"use client";

export default function FolletosPage() {
  return (
    <div className="p-6 min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-bold text-purple-700 mb-4">
        📂 Folletos Comerciales Spartan
      </h1>
      <p className="text-gray-600 text-sm mb-6">
        Accede a los folletos comerciales y presentaciones actualizados.
      </p>

      <div className="w-full h-[85vh] rounded-xl overflow-hidden shadow-lg border">
        <iframe
          src="https://drive.google.com/embeddedfolderview?id=1NnKZzJI3rbGNNuhLR8Sze5zm9YNhcRy4#grid"
          className="w-full h-full"
          allowFullScreen
        />
      </div>
    </div>
  );
}
