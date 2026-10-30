const PATHS = {
    home: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
    briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
    document: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    contract: 'M4 5h16v14H4zM4 10h16M9 10v9',
    settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.6 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2L10 21h4l.6-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
    menu: 'M4 6h16M4 12h16M4 18h16',
    bell: 'M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 004 0',
};

const Icon = ({ name, className = 'h-5 w-5' }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d={PATHS[name]} />
    </svg>
);

export default Icon;
