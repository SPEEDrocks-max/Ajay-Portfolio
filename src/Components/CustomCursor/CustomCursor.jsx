import { useEffect, useRef } from "react";
import gsap from "gsap";
import "./CustomCursor.css";

export default function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;

    if (
      !cursor ||
      !window.matchMedia(
        "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      ).matches
    ) {
      return;
    }

    let isVisible = false;

    const moveX = gsap.quickTo(cursor, "x", {
      duration: 0.06,
      ease: "power2.out",
    });

    const moveY = gsap.quickTo(cursor, "y", {
      duration: 0.06,
      ease: "power2.out",
    });

    const updateCursor = (event) => {
      moveX(event.clientX);
      moveY(event.clientY);

      if (!isVisible) {
        isVisible = true;
        gsap.set(cursor, { autoAlpha: 1 });
      }
    };

    const handleMove = updateCursor;

    const handleLeave = () => {
      if (!isVisible) return;
      isVisible = false;
      gsap.set(cursor, { autoAlpha: 0 });
    };

    const handleOver = (event) => {
      // Pointer events inside a cross-origin player don't reach the parent.
      // Re-sync on re-entry so a leave event at the iframe boundary can't
      // leave the custom cursor hidden after the pointer returns to the page.
      updateCursor(event);

      if (
        event.target instanceof Element &&
        event.target.closest(
          "a, button, [role='button'], [data-cursor]"
        )
      ) {
        cursor.classList.add("is-hovering");
      }
    };

    const handleOut = (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(
          "a, button, [role='button'], [data-cursor]"
        ) &&
        !(
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest(
            "a, button, [role='button'], [data-cursor]"
          )
        )
      ) {
        cursor.classList.remove("is-hovering");
      }
    };

    gsap.set(cursor, {
      x: -100,
      y: -100,
      autoAlpha: 0,
    });

    window.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerover", handleOver);
    document.addEventListener("pointerout", handleOut);
    document.documentElement.addEventListener("pointerleave", handleLeave);
    window.addEventListener("blur", handleLeave);

    document.documentElement.classList.add("has-custom-cursor");

    return () => {
      window.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerover", handleOver);
      document.removeEventListener("pointerout", handleOut);
      document.documentElement.removeEventListener("pointerleave", handleLeave);
      window.removeEventListener("blur", handleLeave);

      document.documentElement.classList.remove("has-custom-cursor");
      gsap.killTweensOf(cursor);
    };
  }, []);

  return (
    <div ref={cursorRef} className="custom-cursor" aria-hidden="true">
      <svg
        className="custom-cursor__arrow"
        width="25"
        height="33"
        viewBox="0 0 25 33"
        fill="none"
      >
        <path
          d="M2 1.5V26L8.5 19.5L13.5 30L17.5 28L12.5 17.5H22L2 1.5Z"
          fill="#111111"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
