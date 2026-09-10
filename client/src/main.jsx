import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Apply persisted theme before first paint to avoid a flash
const storedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', storedTheme);

createRoot(document.getElementById('root')).render(<App />);
