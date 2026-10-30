import { Link } from 'react-router-dom';
import { Button, Icon } from '../components/ui';

const NotFoundPage = () => (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container text-primary-container">
            <Icon name="explore_off" className="text-[32px]" />
        </span>
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary-container">Error 404</p>
        <h1 className="mt-2 text-headline-lg text-on-surface">Page not found</h1>
        <p className="mt-2 max-w-md text-body-md text-secondary">
            The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className="mt-6">
            <Button>
                <Icon name="arrow_back" />
                Back to home
            </Button>
        </Link>
    </div>
);

export default NotFoundPage;
