export default function MetasPage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">📊 Metas Food Septiembre </h1>
      <div className="w-full overflow-auto">
        <div style={{ transform: "scale(0.8)", transformOrigin: "top left" }}>
          <iframe
            src="https://docs.google.com/spreadsheets/d/e/2PACX-1vQeg3EGhKOHiA9cRDqPioN5oaHZUOpDxB1olx-H6jkUIdBnyRvgEBJwe3IQeb3N7e9rnsQy4UnOQlk1/pubhtml?gid=1307997110&single=true"
            width="125%"   // compensamos el scale
            height="1000"
            style={{ border: "1px solid #ddd" }}
          />
        </div>
      </div>
    </main>
  );
}
