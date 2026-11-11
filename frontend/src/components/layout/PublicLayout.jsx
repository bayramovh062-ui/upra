import { Link, Outlet } from 'react-router-dom';
import Navbar from '../Navbar';
import { demoNotice } from '../../lib/demo';
import { useTranslation } from '../../features/locale/useTranslation';

// Dizayndakı tünd footer (Stitch landing). Yalnız mövcud səhifələrə link verir.
const Footer = () => {
    const { t } = useTranslation();
    return (
        <footer className="bg-nav text-secondary-fixed-dim">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8">
                <div className="grid grid-cols-1 gap-6 border-b border-white/10 pb-8 md:grid-cols-5">
                    <div className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-headline-sm text-white">Upra</span>
                        <p className="max-w-sm text-body-md">{t('nav.footer.tagline')}</p>
                    </div>
                    <div>
                        <h4 className="mb-2 text-title-md text-white">{t('nav.footer.platform')}</h4>
                        <ul className="flex flex-col gap-1 text-body-md">
                            <li>
                                <a href="/#workflow" className="transition-colors hover:text-white">
                                    {t('nav.howItWorks')}
                                </a>
                            </li>
                            <li>
                                <a href="/#features" className="transition-colors hover:text-white">
                                    {t('nav.features')}
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="mb-2 text-title-md text-white">{t('nav.footer.account')}</h4>
                        <ul className="flex flex-col gap-1 text-body-md">
                            <li>
                                <Link to="/login" className="transition-colors hover:text-white">
                                    {t('nav.signIn')}
                                </Link>
                            </li>
                            <li>
                                <Link to="/register" className="transition-colors hover:text-white">
                                    {t('nav.createAccount')}
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="flex flex-col gap-1 pt-4 text-caption sm:flex-row sm:items-center sm:justify-between">
                    <p>{t('nav.footer.copyright')}</p>
                    <p>{demoNotice()}</p>
                </div>
            </div>
        </footer>
    );
};

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
