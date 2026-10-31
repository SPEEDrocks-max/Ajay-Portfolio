import { isHttpsUrl, isSafeNavigationItem } from "../lib/globalSettings";

export default function GlobalFooterContent({ settings }) {
  const footer = settings?.footer || {};
  const rawEmail = footer.contactEmail || settings?.contact?.email || "";
  const rawPhone = footer.contactPhone || settings?.contact?.phone || "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "";
  const phone = /^[+()\d .-]{7,24}$/.test(rawPhone) ? rawPhone : "";
  const socials = (settings?.socialLinks || []).filter((item) => item.enabled && item.label && isHttpsUrl(item.url));
  const links = [...(footer.navigation || []), ...(footer.legalLinks || [])]
    .filter(isSafeNavigationItem)
    .sort((a, b) => a.order - b.order);
  const hasContent = footer.description || email || phone || socials.length || links.length || footer.copyright;
  if (!hasContent) return null;

  return (
    <div className="global-footer-content">
      {footer.description && <p>{footer.description}</p>}
      {(email || phone) && <div className="global-footer-content__contact">
        {email && <a href={`mailto:${email}`}>{email}</a>}
        {phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>}
      </div>}
      {socials.length > 0 && <nav aria-label="Social links" className="global-footer-content__links">
        {socials.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer">{item.label}</a>)}
      </nav>}
      {links.length > 0 && <nav aria-label="Footer links" className="global-footer-content__links">
        {links.map((item) => <a key={item.id} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}>{item.label}</a>)}
      </nav>}
      {footer.copyright && <small>{footer.copyright}</small>}
    </div>
  );
}
