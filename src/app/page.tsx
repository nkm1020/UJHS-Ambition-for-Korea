"use client";

import dynamic from "next/dynamic";

// The app reads localStorage and Web Audio on first render, and the 3D avatar
// will need WebGL, so it renders client-side only.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <div className="app-loading">
      <span>Scene</span>
    </div>
  ),
});

export default function Page() {
  return <App />;
}
