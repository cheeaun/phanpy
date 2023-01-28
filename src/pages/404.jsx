import Link from '../components/link';

export default function NotFound() {
  return (
    <div id="not-found-page" className="deck-container" tabIndex="-1">
      <div>
        <h1>404</h1>
        <p>Page not found.</p>
        <p>
          <Link to="/">Go home</Link>.
        </p>
      </div>
    </div>
  );
}
