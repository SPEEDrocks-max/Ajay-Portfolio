import { useEffect, useMemo, useState } from "react";
import { getDesignTarget } from "../lib/pageDesign";
import { loadPublishedSectionConfig, normalizeSectionConfig } from "../lib/pageSections";
import { PageSectionsContext } from "./PageSectionsContext";

function readPreview(target) {
  try {
    const saved = sessionStorage.getItem(`portfolio-studio-sections-preview:${target}`);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export default function PageSectionsScope({ path, children }) {
  const target = getDesignTarget(path);
  const isCategory = target.startsWith("category:");
  const queryTarget = new URLSearchParams(window.location.search).get("studioSectionsPreview");
  const previewTarget = queryTarget === target || (isCategory && queryTarget === "category-detail") ? queryTarget : "";
  const [published, setPublished] = useState(null);
  const [categoryDefault, setCategoryDefault] = useState(null);
  const [preview] = useState(() => previewTarget ? readPreview(previewTarget) : null);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadPublishedSectionConfig(target),
      isCategory ? loadPublishedSectionConfig("category-detail") : Promise.resolve(null),
    ]).then(([specific, fallback]) => {
      if (active) { setPublished(specific); setCategoryDefault(fallback); }
    });
    return () => { active = false; };
  }, [target, isCategory]);

  const normalizedPreview = useMemo(() => preview !== null ? normalizeSectionConfig(preview, previewTarget || target) : null, [preview, previewTarget, target]);
  const sections = useMemo(() => preview !== null ? normalizedPreview : published !== null ? published : isCategory ? categoryDefault : null, [preview, normalizedPreview, published, isCategory, categoryDefault]);
  return <PageSectionsContext.Provider value={{ sections, isPreview: preview !== null, target }}>{children}</PageSectionsContext.Provider>;
}
