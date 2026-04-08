import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: "",
      stack: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Unknown React render error",
      stack: error?.stack || "",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    try {
      window.__discordWheelLastError = {
        message: error?.message || "Unknown React render error",
        stack: error?.stack || "",
        componentStack: errorInfo?.componentStack || "",
      };
    } catch (e) {
      console.error("Failed to store boundary error:", e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0b1020",
            color: "#ffffff",
            padding: "24px",
            fontFamily: "sans-serif",
          }}
        >
          <h1 style={{ marginTop: 0 }}>Spin the Wheel crashed</h1>
          <p>{this.state.message}</p>

          {this.state.stack ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#111827",
                padding: "12px",
                borderRadius: "6px",
                overflowX: "auto",
              }}
            >
              {this.state.stack}
            </pre>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}