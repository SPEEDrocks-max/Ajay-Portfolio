import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_HOME_CONTENT, loadPublishedHomeContent } from "../../lib/homeContent";
import { DEFAULT_CONTACT_EMAIL, DEFAULT_GLOBAL_SETTINGS, DEFAULT_WHATSAPP_URL, GLOBAL_SETTINGS_DRAFT_KEY, isAssetUrl, isHttpsUrl, isInternalRoute, normalizeGlobalSettings } from "../../lib/globalSettings";
import { supabase } from "../../lib/supabase";
import "./globalSettings.css";

import MediaUploadField from "../components/MediaUploadField";
const SOCIAL_LABELS = { instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", vimeo: "Vimeo", behance: "Behance", dribbble: "Dribbble", facebook: "Facebook", other: "Other profile" };

function idFor(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function makeOriginalSettings(value, homeContent) {
  const settings = normalizeGlobalSettings(value);
  const hero = (homeContent || DEFAULT_HOME_CONTENT).find((section) => section.id === "hero")?.content || {};
  settings.identity.websiteName ||= hero.railName || "Ajay Mehta";
  settings.identity.websiteTitle ||= "Video Editor & Storyteller";
  settings.identity.description ||= "Ajay Mehta — Video Editor & Storyteller";
  settings.identity.faviconUrl ||= "/favicon.svg";
  if (!Array.isArray(settings.navigation)) {
    settings.navigation = (hero.navigation || []).map((item, order) => ({
      id: item._key || idFor("nav"), label: item.label || "", href: item.href || "", external: /^https:\/\//i.test(item.href || ""), enabled: true, order,
    }));
  }
  settings.contact.ctaHref ||= hero.buttonHref || "/contact";
  return settings;
}

function friendlyError(error) {
  if (/site_settings_drafts|public_content|schema cache|does not exist/i.test(error?.message || "")) {
    return "The Global Settings migration is pending. Apply supabase/migrations/20261030080000_global_website_settings.sql in Supabase SQL Editor.";
  }
  if (error?.code === "42501" || error?.status === 401 || error?.status === 403) return "Supabase denied this action. Confirm your admin session and existing site settings policies.";
  return error?.message || "Could not save global settings. Please try again.";
}

function validateHref(item, label) {
  if (!item.label.trim() || !item.href.trim()) return `${label}: add a label and destination.`;
  if (item.external ? !isHttpsUrl(item.href) : !isInternalRoute(item.href)) return `${label}: use a supported internal route or a secure https:// link.`;
  return "";
}

function validateSettings(settings) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (settings.contact.email && !emailPattern.test(settings.contact.email)) return "Enter a valid contact email address.";
  if (settings.footer.contactEmail && !emailPattern.test(settings.footer.contactEmail)) return "Enter a valid footer email address.";
  for (const [label, phone] of [["Contact phone", settings.contact.phone], ["Footer phone", settings.footer.contactPhone]]) {
    if (phone && !/^[+()\d .-]{7,24}$/.test(phone)) return `${label} should contain a valid phone number.`;
  }
  if (settings.contact.whatsappUrl) {
    try {
      const url = new URL(settings.contact.whatsappUrl);
      if (url.protocol !== "https:" || !["wa.me", "www.wa.me", "api.whatsapp.com", "www.whatsapp.com"].includes(url.hostname)) return "Use a secure wa.me or WhatsApp link.";
    } catch { return "Enter a valid WhatsApp URL."; }
  }
  if (settings.contact.ctaHref && !(isInternalRoute(settings.contact.ctaHref) || isHttpsUrl(settings.contact.ctaHref) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(settings.contact.ctaHref) || /^tel:\+?[\d(). -]{7,24}$/i.test(settings.contact.ctaHref))) return "Contact CTA must be a supported page route, email, phone, or secure link.";
  for (const [label, value] of [["Logo", settings.identity.logoUrl], ["Favicon", settings.identity.faviconUrl], ["Default sharing image", settings.identity.defaultShareImageUrl], ["Open Graph image", settings.seo.ogImageUrl], ["Twitter/X image", settings.seo.twitterImageUrl]]) {
    if (value && !isAssetUrl(value)) return `${label} must be a secure URL or a site-relative asset path.`;
  }
  if (settings.seo.canonicalDomain) {
    try {
      const url = new URL(settings.seo.canonicalDomain);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return "Canonical domain must be an https:// domain without a path.";
    } catch { return "Enter a valid https:// canonical domain, or leave it blank."; }
  }
  for (const [label, list] of [["Navigation", settings.navigation || []], ["Footer navigation", settings.footer.navigation], ["Legal links", settings.footer.legalLinks]]) {
    const active = list.filter((item) => item.enabled);
    const seen = new Set();
    for (const item of active) {
      const issue = validateHref(item, label);
      if (issue) return issue;
      const key = item.href.trim().replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return `${label} contains a duplicate entry.`;
      seen.add(key);
    }
  }
  for (const profile of settings.socialLinks) {
    if (profile.enabled && (!profile.label.trim() || !isHttpsUrl(profile.url))) return `Add a valid secure URL and label for ${SOCIAL_LABELS[profile.platform] || "the social profile"}, or disable it.`;
  }
  return "";
}

function TextField({ label, value, onChange, placeholder = "", type = "text", maxLength = 240 }) {
  return <label className="admin-global-field"><span>{label}</span><input type={type} inputMode={type === "url" ? "url" : undefined} maxLength={maxLength} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, placeholder = "", rows = 3, maxLength = 500 }) {
  return <label className="admin-global-field"><span>{label}</span><textarea rows={rows} maxLength={maxLength} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ImageSetting({ label, value, onChange, bucket = "images" }) {
  return <MediaUploadField label={label} value={value} bucket={bucket} onChange={({ url }) => onChange(url)} />;
}

export default function GlobalSettings() {
  const [settings, setSettings] = useState(DEFAULT_GLOBAL_SETTINGS);
  const originalRef = useRef(makeOriginalSettings({}, DEFAULT_HOME_CONTENT));
  const [baseline, setBaseline] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState("/");
  const [previewVersion, setPreviewVersion] = useState(0);
  const serialized = JSON.stringify(settings);
  const dirty = Boolean(baseline) && serialized !== baseline;
  const socials = useMemo(() => [...settings.socialLinks].sort((a, b) => a.order - b.order), [settings.socialLinks]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        if (!supabase) throw new Error("Supabase is not configured for this project.");
        const [liveResult, draftResult, homeContent] = await Promise.all([
          supabase.from("site_settings").select("public_content").limit(1).maybeSingle(),
          supabase.from("site_settings_drafts").select("settings,updated_at").eq("id", true).maybeSingle(),
          loadPublishedHomeContent(),
        ]);
        if (liveResult.error) throw liveResult.error;
        if (draftResult.error) throw draftResult.error;
        const original = makeOriginalSettings(liveResult.data?.public_content || {}, homeContent);
        if (!active) return;
        originalRef.current = original;
        const initial = draftResult.data?.settings ? normalizeGlobalSettings(draftResult.data.settings) : original;
        setSettings(initial);
        setBaseline(JSON.stringify(initial));
        setHasDraft(Boolean(draftResult.data));
        setStatus(draftResult.data?.updated_at ? `Draft saved · ${new Date(draftResult.data.updated_at).toLocaleString()}` : liveResult.data?.public_content && Object.keys(liveResult.data.public_content).length ? "Published settings loaded" : "Using the existing website settings");
      } catch (loadError) {
        if (active) { setSettings(originalRef.current); setBaseline(JSON.stringify(originalRef.current)); setError(friendlyError(loadError)); }
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeLeave = (event) => { event.preventDefault(); event.returnValue = ""; };
    const confirmNavigation = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target || anchor.origin !== window.location.origin || anchor.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved Global Settings changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    document.addEventListener("click", confirmNavigation, true);
    return () => { window.removeEventListener("beforeunload", warnBeforeLeave); document.removeEventListener("click", confirmNavigation, true); };
  }, [dirty]);

  function updateGroup(group, key, value) {
    setSettings((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
    setMessage(""); setStatus("Unsaved changes");
  }

  function updateLinkList(path, index, key, value) {
    setSettings((current) => {
      const [group, listKey] = path;
      const list = [...(group === "navigation" ? current.navigation || [] : current[group][listKey])];
      list[index] = { ...list[index], [key]: value };
      if (group === "navigation") return { ...current, navigation: list.map((item, order) => ({ ...item, order })) };
      return { ...current, [group]: { ...current[group], [listKey]: list.map((item, order) => ({ ...item, order })) } };
    });
    setMessage(""); setStatus("Unsaved changes");
  }

  function moveLink(path, index, direction) {
    setSettings((current) => {
      const [group, listKey] = path;
      const list = [...(group === "navigation" ? current.navigation || [] : current[group][listKey])];
      const destination = index + direction;
      if (destination < 0 || destination >= list.length) return current;
      [list[index], list[destination]] = [list[destination], list[index]];
      const ordered = list.map((item, order) => ({ ...item, order }));
      return group === "navigation" ? { ...current, navigation: ordered } : { ...current, [group]: { ...current[group], [listKey]: ordered } };
    });
    setStatus("Unsaved changes");
  }

  function removeLink(path, index) {
    setSettings((current) => {
      const [group, listKey] = path;
      const source = group === "navigation" ? current.navigation || [] : current[group][listKey];
      const list = source.filter((_, itemIndex) => itemIndex !== index).map((item, order) => ({ ...item, order }));
      return group === "navigation" ? { ...current, navigation: list } : { ...current, [group]: { ...current[group], [listKey]: list } };
    });
    setStatus("Unsaved changes");
  }

  function addLink(path, external = false) {
    setSettings((current) => {
      const [group, listKey] = path;
      const source = group === "navigation" ? current.navigation || [] : current[group][listKey];
      const list = [...source, { id: idFor("link"), label: "", href: external ? "https://" : "/contact", external, enabled: true, order: source.length }];
      return group === "navigation" ? { ...current, navigation: list } : { ...current, [group]: { ...current[group], [listKey]: list } };
    });
    setStatus("Unsaved changes");
  }

  function addOtherSocial() {
    setSettings((current) => ({ ...current, socialLinks: [...current.socialLinks, { id: idFor("social"), platform: "other", label: "", url: "", enabled: true, order: current.socialLinks.length }] }));
    setStatus("Unsaved changes");
  }

  function updateSocial(id, key, value) {
    setSettings((current) => ({ ...current, socialLinks: current.socialLinks.map((profile) => profile.id === id ? { ...profile, [key]: value } : profile) }));
    setStatus("Unsaved changes");
  }

  function moveSocial(id, direction) {
    setSettings((current) => {
      const list = [...current.socialLinks].sort((a, b) => a.order - b.order);
      const index = list.findIndex((profile) => profile.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= list.length) return current;
      [list[index], list[destination]] = [list[destination], list[index]];
      return { ...current, socialLinks: list.map((profile, order) => ({ ...profile, order })) };
    });
    setStatus("Unsaved changes");
  }

  async function saveDraft() {
    setError(""); setMessage("");
    const validation = validateSettings(settings);
    if (validation) { setError(validation); return; }
    setBusy(true);
    try {
      const { error: saveError } = await supabase.from("site_settings_drafts").upsert({ id: true, settings }, { onConflict: "id" });
      if (saveError) throw saveError;
      const saved = JSON.stringify(settings); setBaseline(saved); setHasDraft(true); setStatus("Draft saved just now"); setMessage("Draft saved. It is private until you publish it.");
    } catch (saveError) { setError(friendlyError(saveError)); }
    finally { setBusy(false); }
  }

  async function publish() {
    setError(""); setMessage("");
    const validation = validateSettings(settings);
    if (validation) { setError(validation); return; }
    if (!window.confirm("Publish these global settings to the live website?")) return;
    setBusy(true);
    try {
      const { data: row, error: lookupError } = await supabase.from("site_settings").select("id").limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      const saveResult = row
        ? await supabase.from("site_settings").update({ public_content: settings }).eq("id", row.id)
        : await supabase.from("site_settings").insert({ public_content: settings });
      if (saveResult.error) throw saveResult.error;
      const { error: deleteError } = await supabase.from("site_settings_drafts").delete().eq("id", true);
      if (deleteError) throw deleteError;
      const saved = JSON.stringify(settings); setBaseline(saved); setHasDraft(false); setStatus("Published just now"); setMessage("Global website settings are now live. Page-wise Design Studio settings were not changed.");
    } catch (publishError) { setError(friendlyError(publishError)); }
    finally { setBusy(false); }
  }

  async function resetOriginal() {
    if (!window.confirm("Reset the live website settings to the existing hardcoded website information and discard the saved draft?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data: row, error: lookupError } = await supabase.from("site_settings").select("id").limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      if (row) {
        const { error: updateError } = await supabase.from("site_settings").update({ public_content: {} }).eq("id", row.id);
        if (updateError) throw updateError;
      }
      const { error: deleteError } = await supabase.from("site_settings_drafts").delete().eq("id", true);
      if (deleteError) throw deleteError;
      const original = originalRef.current;
      setSettings(original); setBaseline(JSON.stringify(original)); setHasDraft(false); setStatus("Original website settings restored"); setMessage("Custom global settings were cleared. Existing page content and page-specific design remain intact.");
      sessionStorage.removeItem(GLOBAL_SETTINGS_DRAFT_KEY); setPreviewOpen(false);
    } catch (resetError) { setError(friendlyError(resetError)); }
    finally { setBusy(false); }
  }

  function openPreview() {
    setError(""); setMessage("");
    const validation = validateSettings(settings);
    if (validation) { setError(validation); return; }
    try {
      sessionStorage.setItem(GLOBAL_SETTINGS_DRAFT_KEY, JSON.stringify(settings));
      setPreviewVersion((version) => version + 1); setPreviewOpen(true); setMessage("Preview is using these settings in this admin browser session only.");
    } catch { setError("Could not prepare the preview in this browser session."); }
  }

  const navPath = ["navigation", null];
  const footerPath = ["footer", "navigation"];
  const legalPath = ["footer", "legalLinks"];
  const renderLinkList = (list, path, title, allowInternal = true) => <div className="admin-global-links">
    {list.map((item, index) => <div className="admin-global-link" key={item.id}>
      <div className="admin-global-link__fields">
        <TextField label="Label" value={item.label} onChange={(value) => updateLinkList(path, index, "label", value)} placeholder="Link label" maxLength={80} />
        <label className="admin-global-field"><span>Destination type</span><select value={item.external ? "external" : "internal"} onChange={(event) => updateLinkList(path, index, "external", event.target.value === "external")}><option value="internal" disabled={!allowInternal}>Existing site route</option><option value="external">External HTTPS link</option></select></label>
        <TextField label="Destination" type="url" value={item.href} onChange={(value) => updateLinkList(path, index, "href", value)} placeholder={item.external ? "https://example.com" : "/contact or #selected-work"} maxLength={500} />
      </div>
      <label className="admin-global-toggle"><input type="checkbox" checked={item.enabled} onChange={(event) => updateLinkList(path, index, "enabled", event.target.checked)} /><span>Visible</span></label>
      <div className="admin-global-link__actions"><button type="button" aria-label={`Move ${title} link up`} disabled={index === 0} onClick={() => moveLink(path, index, -1)}>↑</button><button type="button" aria-label={`Move ${title} link down`} disabled={index === list.length - 1} onClick={() => moveLink(path, index, 1)}>↓</button><button className="is-danger" type="button" onClick={() => removeLink(path, index)}>REMOVE</button></div>
    </div>)}
  </div>;

  return <section className="admin-global-settings" aria-labelledby="admin-global-settings-title">
    <div className="admin-page-heading admin-media__heading"><div><p className="admin-page-heading__eyebrow">SITE-WIDE INFORMATION / GLOBAL SETTINGS</p><h1 id="admin-global-settings-title">Global <em>Settings.</em></h1><p className="admin-media__description">Manage shared website information. Page-specific visual styles remain in Design Studio.</p></div><span className="admin-page-heading__folio">09 — 10</span></div>

    <div className="admin-global-toolbar"><div><strong>{status || (hasDraft ? "Saved draft loaded" : "Settings loaded")}</strong><span>{dirty ? "Unsaved changes" : hasDraft ? "Private draft" : "Current published settings"}</span></div><div><button type="button" onClick={saveDraft} disabled={loading || busy || (!dirty && hasDraft)}>SAVE DRAFT</button><button type="button" onClick={openPreview} disabled={loading || busy}>PREVIEW</button><button className="is-primary" type="button" onClick={publish} disabled={loading || busy}>PUBLISH</button><button className="is-danger" type="button" onClick={resetOriginal} disabled={loading || busy}>RESET TO ORIGINAL</button></div></div>
    {message && <p className="admin-media-message admin-media-message--success" role="status">{message}</p>}
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {loading ? <div className="admin-media-state" role="status">Loading global settings…</div> : <div className="admin-global-panels">
      <section className="admin-global-panel"><div><p className="admin-page-heading__eyebrow">01 / IDENTITY</p><h2>Website identity</h2><p>Set the shared name and assets visitors see across the portfolio.</p></div><div className="admin-global-grid">
        <TextField label="Website name" value={settings.identity.websiteName} onChange={(value) => updateGroup("identity", "websiteName", value)} placeholder="Ajay Mehta" maxLength={120} />
        <TextField label="Website title" value={settings.identity.websiteTitle} onChange={(value) => updateGroup("identity", "websiteTitle", value)} placeholder="Video Editor & Storyteller" maxLength={180} />
        <TextArea label="Short website description" value={settings.identity.description} onChange={(value) => updateGroup("identity", "description", value)} placeholder="A concise description of the portfolio" maxLength={320} />
        <ImageSetting label="Website logo" bucket="logos" value={settings.identity.logoUrl} onChange={(value) => updateGroup("identity", "logoUrl", value)} />
        <ImageSetting label="Favicon" bucket="logos" value={settings.identity.faviconUrl} onChange={(value) => updateGroup("identity", "faviconUrl", value)} />
        <ImageSetting label="Default social sharing image" bucket="thumbnails" value={settings.identity.defaultShareImageUrl} onChange={(value) => updateGroup("identity", "defaultShareImageUrl", value)} />
      </div></section>

      <section className="admin-global-panel"><div><p className="admin-page-heading__eyebrow">02 / NAVIGATION</p><h2>Navigation</h2><p>Manage the homepage navigation. Existing site routes and secure external links are supported.</p></div>{renderLinkList(settings.navigation || [], navPath, "navigation")}<button className="admin-global-add" type="button" onClick={() => addLink(navPath)}>+ ADD NAVIGATION LINK</button></section>

      <section className="admin-global-panel"><div><p className="admin-page-heading__eyebrow">03 / CONTACT</p><h2>Contact information</h2><p>Leave fields empty if you do not want that information displayed.</p></div><div className="admin-global-grid">
        <TextField label="Contact email" type="email" value={settings.contact.email} onChange={(value) => updateGroup("contact", "email", value)} placeholder={DEFAULT_CONTACT_EMAIL} />
        <TextField label="Phone number" type="tel" value={settings.contact.phone} onChange={(value) => updateGroup("contact", "phone", value)} placeholder="+1 555 0100" />
        <TextField label="WhatsApp URL" type="url" value={settings.contact.whatsappUrl} onChange={(value) => updateGroup("contact", "whatsappUrl", value)} placeholder={DEFAULT_WHATSAPP_URL} maxLength={500} />
        <TextField label="Location or address" value={settings.contact.location} onChange={(value) => updateGroup("contact", "location", value)} placeholder="Optional" maxLength={240} />
        <TextField label="Contact CTA destination" type="url" value={settings.contact.ctaHref} onChange={(value) => updateGroup("contact", "ctaHref", value)} placeholder="/contact or mailto:name@example.com" maxLength={500} />
      </div></section>

      <section className="admin-global-panel"><div><p className="admin-page-heading__eyebrow">04 / PROFILES</p><h2>Social media</h2><p>Only enabled profiles with secure HTTPS URLs appear on the public website.</p></div><div className="admin-global-socials">{socials.map((profile, index) => <div className="admin-global-social" key={profile.id}><label className="admin-global-toggle"><input type="checkbox" checked={profile.enabled} onChange={(event) => updateSocial(profile.id, "enabled", event.target.checked)} /><span>{SOCIAL_LABELS[profile.platform] || "Other profile"}</span></label>{profile.platform === "other" && <TextField label="Profile name" value={profile.label} onChange={(value) => updateSocial(profile.id, "label", value)} placeholder="Platform name" maxLength={80} />}<TextField label="Profile URL" type="url" value={profile.url} onChange={(value) => updateSocial(profile.id, "url", value)} placeholder="https://…" maxLength={500} /><div className="admin-global-link__actions"><button type="button" aria-label={`Move ${profile.label || SOCIAL_LABELS[profile.platform]} up`} disabled={index === 0} onClick={() => moveSocial(profile.id, -1)}>↑</button><button type="button" aria-label={`Move ${profile.label || SOCIAL_LABELS[profile.platform]} down`} disabled={index === socials.length - 1} onClick={() => moveSocial(profile.id, 1)}>↓</button>{profile.platform === "other" && <button className="is-danger" type="button" onClick={() => setSettings((current) => ({ ...current, socialLinks: current.socialLinks.filter((item) => item.id !== profile.id) }))}>REMOVE</button>}</div></div>)}</div><button className="admin-global-add" type="button" onClick={addOtherSocial}>+ ADD OTHER PROFILE</button></section>

      <section className="admin-global-panel"><div><p className="admin-page-heading__eyebrow">05 / SEARCH &amp; SHARING</p><h2>SEO &amp; social sharing</h2><p>Page-specific SEO title and description take priority. Empty page metadata uses these defaults.</p></div><div className="admin-global-grid">
        <TextField label="Default SEO title" value={settings.seo.title} onChange={(value) => updateGroup("seo", "title", value)} placeholder="Falls back to website title" maxLength={180} />
        <TextArea label="Default meta description" value={settings.seo.description} onChange={(value) => updateGroup("seo", "description", value)} placeholder="Falls back to the website description" maxLength={320} />
        <TextField label="Keywords" value={settings.seo.keywords} onChange={(value) => updateGroup("seo", "keywords", value)} placeholder="Optional, comma-separated" maxLength={500} />
        <TextField label="Open Graph title" value={settings.seo.ogTitle} onChange={(value) => updateGroup("seo", "ogTitle", value)} placeholder="Uses the SEO title when blank" maxLength={180} />
        <TextArea label="Open Graph description" value={settings.seo.ogDescription} onChange={(value) => updateGroup("seo", "ogDescription", value)} placeholder="Uses the meta description when blank" maxLength={320} />
        <ImageSetting label="Open Graph image" bucket="thumbnails" value={settings.seo.ogImageUrl} onChange={(value) => updateGroup("seo", "ogImageUrl", value)} />
        <ImageSetting label="Twitter/X sharing image" bucket="thumbnails" value={settings.seo.twitterImageUrl} onChange={(value) => updateGroup("seo", "twitterImageUrl", value)} />
        <TextField label="Canonical domain" type="url" value={settings.seo.canonicalDomain} onChange={(value) => updateGroup("seo", "canonicalDomain", value)} placeholder="Leave blank until the production domain is known" maxLength={300} />
      </div></section>

      <section className="admin-global-panel"><div><p className="admin-page-heading__eyebrow">06 / FOOTER</p><h2>Footer content</h2><p>These optional details appear within the existing page footer design.</p></div><div className="admin-global-grid">
        <TextField label="Copyright text" value={settings.footer.copyright} onChange={(value) => updateGroup("footer", "copyright", value)} placeholder="Optional" maxLength={180} />
        <TextArea label="Footer description" value={settings.footer.description} onChange={(value) => updateGroup("footer", "description", value)} placeholder="Optional" maxLength={500} />
        <TextField label="Footer email override" type="email" value={settings.footer.contactEmail} onChange={(value) => updateGroup("footer", "contactEmail", value)} placeholder="Uses contact email when blank" />
        <TextField label="Footer phone override" type="tel" value={settings.footer.contactPhone} onChange={(value) => updateGroup("footer", "contactPhone", value)} placeholder="Uses contact phone when blank" />
      </div><h3>Footer navigation</h3>{renderLinkList(settings.footer.navigation, footerPath, "footer navigation")}<button className="admin-global-add" type="button" onClick={() => addLink(footerPath)}>+ ADD FOOTER LINK</button><h3>Legal &amp; external links</h3>{renderLinkList(settings.footer.legalLinks, legalPath, "legal link")}<button className="admin-global-add" type="button" onClick={() => addLink(legalPath, true)}>+ ADD LEGAL / EXTERNAL LINK</button></section>
    </div>}

    {previewOpen && <section className="admin-global-preview"><div><div><p className="admin-page-heading__eyebrow">PRIVATE DRAFT PREVIEW</p><h2>Public page preview</h2><p>This preview uses real public components and is visible only in this admin browser session.</p></div><div className="admin-global-preview__actions"><label className="admin-global-field"><span>PREVIEW PAGE</span><select value={previewPath} onChange={(event) => setPreviewPath(event.target.value)}><option value="/">Home</option><option value="/about">About</option><option value="/work">Work</option><option value="/contact">Contact</option></select></label><button type="button" onClick={() => setPreviewOpen(false)}>CLOSE PREVIEW</button></div></div><iframe key={`${previewVersion}-${previewPath}`} title="Global settings public page preview" src={`${previewPath}?globalSettingsPreview=${previewVersion}`} />
    </section>}

  </section>;
}
