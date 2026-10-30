import { Link, Outlet } from 'react-router-dom';
import Icon from '../ui/Icon';

// Dizayndakı sol brend paneli: izahedici nümunə lövhə. Məlumatlar təsadüfi nümunədir, real deyil.
const SAMPLE_CARDS = [
    { key: 'UPR-12', title: 'Design landing page', tag: 'In progress', person: 'ER' },
    { key: 'UPR-14', title: 'Set up REST API', tag: 'To do', person: 'DK' },
];

const BrandPanel = () => (
    <div className="relative flex flex-col justify-between overflow-hidden bg-primary-container p-8 text-on-primary lg:col-span-5 lg:p-14">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary opacity-60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-surface-tint opacity-40 blur-3xl" />

        <Link to="/" className="relative z-10 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary shadow-md">
                <Icon name="dataset" filled className="text-[24px]" />
            </span>
            <span className="text-headline-md font-bold tracking-tight text-white">Upra</span>
        </Link>

        <div className="relative z-10 my-10 flex flex-col gap-8 lg:my-0">
            <div>
                <h1 className="mb-4 text-display-lg font-bold text-white">
                    Hire. Collaborate. Deliver — in one place.
                </h1>
                <p className="max-w-md text-body-lg text-on-primary-container">
                    Post a job, accept a proposal and get a Kanban workspace for the project
                    automatically. No switching between a marketplace and a task tracker.
                </p>
            </div>

            <div className="w-full rounded-xl bg-white/10 p-5 shadow-xl backdrop-blur-md">
                <div className="mb-3.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-title-md text-white">
                        <Icon name="view_kanban" className="text-[18px]" />
                        Project board
                    </span>
                    <span className="rounded-full bg-white/20 px-2.5 py-1 text-caption text-white">
                        Sample
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {SAMPLE_CARDS.map((card) => (
                        <div key={card.key} className="rounded-xl bg-white p-3.5 text-on-surface shadow-sm">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-caption text-primary">
                                    {card.tag}
                                </span>
                                <span className="text-caption text-secondary">{card.key}</span>
                            </div>
                            <p className="mb-2.5 line-clamp-1 text-body-md font-semibold">{card.title}</p>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high text-[10px] font-bold text-primary">
                                {card.person}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <p className="relative z-10 pt-6 text-label-md text-on-primary-container">
            Built as a Holberton School portfolio project.
        </p>
    </div>
);

// /login və /register üçün: sol brend paneli, sağda forma (Outlet)
const AuthLayout = () => (
    <div className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-12">
        <BrandPanel />
        <div className="flex flex-col bg-surface p-6 sm:p-10 lg:col-span-7 lg:p-14">
            <Outlet />
            <p className="pt-8 text-caption text-secondary">© 2026 Upra</p>
        </div>
    </div>
);

export default AuthLayout;
