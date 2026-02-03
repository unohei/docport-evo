import "../index.css";

export default function Root({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F8FC",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {children}
    </div>
  );
}
