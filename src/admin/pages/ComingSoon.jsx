export default function ComingSoon({ title }) {
  return (
    <section className="admin-coming-soon" aria-labelledby="coming-soon-title">
      <p className="admin-page-heading__eyebrow">WORKSPACE / IN DEVELOPMENT</p>
      <h1 id="coming-soon-title">{title}</h1>
      <p>This workspace is reserved for a future phase.</p>
      <span>COMING SOON</span>
    </section>
  );
}
