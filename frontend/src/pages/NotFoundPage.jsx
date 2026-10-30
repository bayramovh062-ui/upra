import { Link } from 'react-router-dom';

const NotFoundPage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
            {/* 404 Xəta səhifəsi */}
            <h1 className="text-4xl font-bold text-red-500">404</h1>
            <p className="mt-2 text-lg">Page Not Found</p>
            {/* Ana səhifəyə geri dönmə linki */}
            <Link to="/" className="mt-4 text-blue-500 hover:underline">
                Back to Home
            </Link>
        </div>
    );
};

export default NotFoundPage;