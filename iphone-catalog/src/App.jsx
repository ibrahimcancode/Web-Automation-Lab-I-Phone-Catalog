import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './state/ThemeContext';
import { ChaosProvider } from './chaos';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ModelDetail from './pages/ModelDetail';
import Compare from './pages/Compare';
import Favorites from './pages/Favorites';
import NotFound from './pages/NotFound';
import './App.css';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ChaosProvider>
          <div className="app">
            <Header />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/model/:slug" element={<ModelDetail />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </ChaosProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
