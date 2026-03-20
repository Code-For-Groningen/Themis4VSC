import * as React from 'react';
import ThemisSidebar from './ThemisSidebar';

// ReactDOM.render(
//     <ThemisSidebar />,
//     document.getElementById('root')
// );


// Use the new React 19 API with concurrent features (createPortal and root API)
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<ThemisSidebar />);
} else {
    console.error("Failed to find root element");
}


// document.getElementById('root')!.innerHTML = 'Hello World';