import Map from "./components/maps/Map";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import GCPGrid from "./components/grids/GCPGrid";
import GISMAP from "./pages/GISMAP";
import TestGrid from "./components/grids/TestGrid";
// import GISMAP from "./components/GISMAP";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GISMAP />} />
        <Route path="/map" element={<Map />} />
        <Route path="/test" element={<TestGrid />} />
        <Route path="/gcp" element={<GISMAP />} />
      </Routes>
    </Router>
  );
}

export default App;
