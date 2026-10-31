import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import "./Intro.css";

const INITIAL = [
  { id: "a1", char: "A" },
  { id: "y", char: "y" },
  { id: "a2", char: "a" },
  { id: "j", char: "j" },
];

const SWAPS = [
  ["a2", "j"], // AYAJ -> AYJA
  ["y", "j"],  // AYJA -> AJYA
  ["y", "a2"], // AJYA -> AJAY
];

const GAP = 5;
const SWAP_DURATION = 0.38;
const STEP_GAP = 0.015;
const FINAL_ORDER = ["a1", "j", "a2", "y"];

function getPositions(order, widths) {
  let cursor = 0;
  const positions = new Map();

  order.forEach((id, index) => {
    positions.set(id, cursor);
    cursor += widths.get(id) + (index < order.length - 1 ? GAP : 0);
  });

  return { positions, width: cursor };
}

export default function Intro({ onComplete, displayName = "Ajay Mehta", hindiName = "मेहता" }) {
  const rootRef = useRef(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  const englishName = nameParts[0] || "Ajay";
  const hindiDisplayName = hindiName || nameParts.at(-1) || "मेहता";
  const useLetterReorder = englishName.toLowerCase() === "ajay";

  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let cancelled = false;
    let animationStarted = false;
    let timeline;
    let fontFallbackTimer;

    const finishIntro = () => {
      if (cancelled || completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current?.();
    };

    const context = gsap.context(() => {
      const track = root.querySelector(".intro-english");
      const name = root.querySelector(".intro-full-name");
      const letters = Array.from(root.querySelectorAll(".intro-letter"));
      const letterById = new Map(letters.map((letter) => [letter.dataset.id, letter]));

      const restoreFinalLayout = () => {
        FINAL_ORDER.forEach((id) => track.appendChild(letterById.get(id)));
        letters.forEach((letter) => {
          letter.style.position = "static";
          letter.style.left = "";
        });
        track.style.width = "";
        gsap.set(letters, { clearProps: "transform" });
      };

      const startAnimation = () => {
        if (cancelled || animationStarted || !track || !name) return;
        animationStarted = true;
        window.clearTimeout(fontFallbackTimer);

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          if (useLetterReorder) restoreFinalLayout();
          finishIntro();
          return;
        }

        if (!useLetterReorder) {
          timeline = gsap.timeline({ onComplete: finishIntro });
          timeline.fromTo(name, { autoAlpha: 0, scale: 0.98 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "power2.out" });
          timeline.to({}, { duration: 0.6 });
          return;
        }

        const widths = new Map(
          letters.map((letter) => [letter.dataset.id, letter.getBoundingClientRect().width]),
        );
        let order = INITIAL.map(({ id }) => id);
        const initialLayout = getPositions(order, widths);

        track.style.width = `${initialLayout.width}px`;
        letters.forEach((letter) => {
          letter.style.position = "absolute";
          letter.style.left = "0px";
        });
        gsap.set(letters, {
          x: (_index, letter) => initialLayout.positions.get(letter.dataset.id),
        });

        timeline = gsap.timeline({ onComplete: finishIntro });
        timeline.to({}, { duration: 0.08 });

        SWAPS.forEach(([leftId, rightId]) => {
          const leftIndex = order.indexOf(leftId);
          if (leftIndex < 0 || order[leftIndex + 1] !== rightId) return;

          const nextOrder = [...order];
          [nextOrder[leftIndex], nextOrder[leftIndex + 1]] = [
            nextOrder[leftIndex + 1],
            nextOrder[leftIndex],
          ];
          const nextLayout = getPositions(nextOrder, widths);
          const destinations = nextLayout.positions;

          track.style.width = `${Math.max(initialLayout.width, nextLayout.width)}px`;
          timeline.to(letters, {
            x: (_index, letter) => destinations.get(letter.dataset.id),
            duration: SWAP_DURATION,
            ease: "power2.inOut",
          });
          timeline.to({}, { duration: STEP_GAP });
          order = nextOrder;
        });

        timeline.add(restoreFinalLayout);
        timeline.to({}, { duration: 0.8 });
      };

      if (document.fonts?.ready) {
        // A remote font request can stall `document.fonts.ready` for a long
        // time. Keep the intro from blocking the whole site in that case.
        fontFallbackTimer = window.setTimeout(startAnimation, 1200);
        document.fonts.ready.then(startAnimation, startAnimation);
      } else {
        startAnimation();
      }
    }, root);

    return () => {
      cancelled = true;
      window.clearTimeout(fontFallbackTimer);
      timeline?.kill();
      context.revert();
    };
  }, [useLetterReorder]);

  return (
    <div ref={rootRef} className="intro-overlay" role="status" aria-label={displayName}>
      <div className="intro-content">
        <div className="intro-full-name">
          <div className="intro-english" aria-label={englishName} aria-live="off">
            {useLetterReorder ? INITIAL.map(({ id, char }) => (
              <span className="intro-letter" data-id={id} key={id} aria-hidden="true">
                {char}
              </span>
            )) : englishName}
          </div>
          <span className="intro-hindi" lang="hi">{hindiDisplayName}</span>
        </div>
      </div>
    </div>
  );
}





