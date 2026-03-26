import { createRoot } from 'react-dom/client';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container not found.');
}

const rootElement = container;

async function mount() {
  const { default: App } = await import('./App');
  createRoot(rootElement).render(<App initialPath={window.location.pathname} />);
}

mount();
