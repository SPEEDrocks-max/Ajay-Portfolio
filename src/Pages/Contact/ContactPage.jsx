import './ContactPage.css'
import { usePageSections } from "../../Components/PageSectionsContext";
import { useGlobalSettings } from "../../Components/GlobalSettingsContext";
import { DEFAULT_CONTACT_EMAIL, DEFAULT_WHATSAPP_URL, isHttpsUrl } from "../../lib/globalSettings";
import GlobalFooterContent from "../../Components/GlobalFooterContent";

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function ContactPage({ onBack }) {
  const { sections: configuredSections } = usePageSections();
  const { settings } = useGlobalSettings();
  const email = isValidEmail(settings.contact.email) ? settings.contact.email : DEFAULT_CONTACT_EMAIL;
  const whatsappUrl = isHttpsUrl(settings.contact.whatsappUrl) ? settings.contact.whatsappUrl : DEFAULT_WHATSAPP_URL;
  const sections = configuredSections || [
    { id: "contact-header", type: "contact-header", enabled: true, order: 0, content: {} },
    { id: "contact-content", type: "contact-content", enabled: true, order: 1, content: {} },
    { id: "contact-footer", type: "contact-footer", enabled: true, order: 2, content: {} },
  ];
  return (
    <main className="contact-page">
      {[...sections].filter((section) => section.enabled).sort((a, b) => a.order - b.order).map((section) => {
        const content = section.content || {};
        if (section.type === "contact-header") return <header className="contact-page__topline" data-design-section="header" key={section.id}><button className="work-back" type="button" onClick={onBack}>← BACK TO HOME</button><span>{settings.identity.websiteName || "AJAY MEHTA"} <i>/</i> CONTACT</span></header>;
        if (section.type === "contact-content") return <section className="contact-page__content" data-design-section="contact" key={section.id}>
          <div className="contact-page__intro">
            <p className="work-eyebrow">LET’S WORK TOGETHER</p>
            <h1 className="contact-page__title" style={{ whiteSpace: "pre-line" }}>{content.heading || "Have a story\nto shape?"}</h1>
            <p>{content.description || settings.identity.description || "For project enquiries and collaborations, get in touch."}</p>
          </div>
          <div className="contact-page__options" aria-label="Contact options">
            <a className="contact-page__option contact-page__option--whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <span className="contact-page__option-number">01 / WHATSAPP</span>
              <strong>Let’s talk about your project.</strong>
              <span className="contact-page__option-action">MESSAGE ON WHATSAPP <i aria-hidden="true">↗</i></span>
            </a>
            <a className="contact-page__option contact-page__option--email" href={`mailto:${email}`}>
              <span className="contact-page__option-number">02 / EMAIL</span>
              <strong>Prefer email?</strong>
              <span className="contact-page__option-address">{email}</span>
              <span className="contact-page__option-action">SEND AN EMAIL <i aria-hidden="true">↗</i></span>
            </a>
          </div>
        </section>;
        if (section.type === "contact-footer") return <footer className="contact-page__footer" data-design-section="footer" key={section.id}><button type="button" onClick={onBack}>{content.returnLabel || "RETURN HOME ↑"}</button><GlobalFooterContent settings={settings} /></footer>;
        return null;
      })}
    </main>
  )
}
