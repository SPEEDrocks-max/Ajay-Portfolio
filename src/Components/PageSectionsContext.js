import { createContext, useContext } from "react";

export const PageSectionsContext = createContext({ sections: null });
export const usePageSections = () => useContext(PageSectionsContext);
