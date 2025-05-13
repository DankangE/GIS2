import Map from "./components/maps/Map";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TestGrid from "./components/grids/TestGrid";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Map />} />
        <Route path="/grid" element={<TestGrid />} />
      </Routes>
    </Router>
  );
}

export default App;
