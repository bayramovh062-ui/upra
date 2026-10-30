import { Link, Outlet } from 'react-router-dom';
import Navbar from '../Navbar';

// Dizayndakı tünd footer (Stitch landing). Yalnız mövcud səhifələrə link verir.
const Footer = () => (
    <footer className="bg-nav text-secondary-fixed-dim">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8">
            <div className="grid grid-cols-1 gap-6 border-b border-white/10 pb-8 md:grid-cols-5">
                <div className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-headline-sm text-white">Upra</span>
                    <p className="max-w-sm text-body-md">
                        A freelance marketplace and a project board in one flow. Built as a Holberton School
                        portfolio project.
                    </p>
                </div>
                <div>
                    <h4 className="mb-2 text-title-md text-white">Platform</h4>
                    <ul className="flex flex-col gap-1 text-body-md">
                        <li>
                            <a href="/#workflow" className="transition-colors hover:text-white">
                                How it works
                            </a>
                        </li>
                        <li>
                            <a href="/#features" className="transition-colors hover:text-white">
                                Features
                            </a>
                        </li>
                    </ul>
                </div>
                <div>
                    <h4 className="mb-2 text-title-md text-white">Account</h4>
                    <ul className="flex flex-col gap-1 text-body-md">
                        <li>
                            <Link to="/login" className="transition-colors hover:text-white">
                                Sign in
                            </Link>
                        </li>
                        <li>
                            <Link to="/register" className="transition-colors hover:text-white">
                                Create account
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>
            <p className="pt-4 text-caption">© 2026 Upra</p>
        </div>
    </footer>
);

// Qonaq səhifələri üçün qabıq (landing, 404)
const PublicLayout = () => (
    <>
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)] bg-canvas">
            <Outlet />
        </main>
        <Footer />
    </>
);

export default PublicLayout;
