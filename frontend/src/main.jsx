import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './app/store';
import ThemeSync from './features/theme/ThemeSync';
import LocaleSync from './features/locale/LocaleSync';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeSync />
      <LocaleSync />
      <App />
    </Provider>
  </React.StrictMode>
);
