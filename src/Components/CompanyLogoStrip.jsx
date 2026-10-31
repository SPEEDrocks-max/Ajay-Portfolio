import "./CompanyLogoStrip.css";

function LogoGroup({ logos, duplicate = false }) {
  return (
    <div className="company-strip__group" aria-hidden={duplicate}>
      {logos.map(({ src, logoUrl, name, url }, index) => (
        <div className="company-strip__logo" key={name || index}>
          {url && !duplicate ? <a href={url} target="_blank" rel="noreferrer" aria-label={name}><img src={logoUrl || src} alt={name} loading="lazy" /></a> : <img src={logoUrl || src} alt={duplicate ? "" : name} loading="lazy" />}
        </div>
      ))}
    </div>
  );
}

export default function CompanyLogoStrip({ content, style, ...sectionProps }) {
  const logos = (content?.logos || []).filter((logo) => (logo.logoUrl || logo.src) && logo.name);
  return (
    <footer {...sectionProps} className="company-strip" aria-labelledby="company-strip-title" style={style}>
      <h2 className="company-strip__title" id="company-strip-title">{content?.title}</h2>
      <div className="company-strip__viewport" role="region" aria-label="Company logos" tabIndex={0}>
        <div className="company-strip__track">
          <LogoGroup logos={logos} />
          <LogoGroup logos={logos} duplicate />
        </div>
      </div>
    </footer>
  );
}
