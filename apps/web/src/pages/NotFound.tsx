import { Link } from 'react-router-dom';
import { Page } from '../components/ui.tsx';

export function NotFound() {
  return (
    <Page
      eyebrow="404"
      title="This page does not exist."
      lead={
        <>
          Go back to the <Link to="/">home page</Link> or see the <Link to="/jobs">live jobs</Link>.
        </>
      }
    >
      {null}
    </Page>
  );
}
