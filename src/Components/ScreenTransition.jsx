import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./ScreenTransition.css";

const DOT_COUNT = 16;
const FRAME_INSET = 4;

function getCornerPath(x, y, width, height, length) {
  const right = x + width;
  const bottom = y + height;
  const horizontal = Math.min(length, width / 3);
  const vertical = Math.min(length, height / 3);

  return [
    `M ${x} ${y + vertical} V ${y} H ${x + horizontal}`,
    `M ${right - horizontal} ${y} H ${right} V ${y + vertical}`,
    `M ${right} ${bottom - vertical} V ${bottom} H ${right - horizontal}`,
    `M ${x + horizontal} ${bottom} H ${x} V ${bottom - vertical}`,
  ].join(" ");
}

function getPerimeterPoints({ x, y, width, height }, count = DOT_COUNT) {
  const perimeterDotCount = count - 4;
  const perimeter = 2 * (width + height);
  const step = perimeter / perimeterDotCount;

  const perimeterPoints = Array.from({ length: perimeterDotCount }, (_, index) => {
    let distance = index * step;

    if (distance <= width) return { x: x + distance, y };
    distance -= width;
    if (distance <= height) return { x: x + width, y: y + distance };
    distance -= height;
    if (distance <= width) return { x: x + width - distance, y: y + height };
    distance -= width;
    return { x, y: y + height - distance };
  });

  return [
    ...perimeterPoints,
    { x: x + width / 2, y },
    { x: x + width, y: y + height / 2 },
    { x: x + width / 2, y: y + height },
    { x, y: y + height / 2 },
  ];
}

function getInnerFrame(frame) {
  return {
    x: frame.x + FRAME_INSET,
    y: frame.y + FRAME_INSET,
    width: Math.max(0, frame.width - FRAME_INSET * 2),
    height: Math.max(0, frame.height - FRAME_INSET * 2),
  };
}

function addFrameTweens(timeline, refs, frame, duration, ease, position) {
  const inner = getInnerFrame(frame);
  const dots = getPerimeterPoints(frame);

  timeline.to(refs.box, {
    attr: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
    duration,
    ease,
  }, position);
  timeline.to(refs.innerBox, {
    attr: { x: inner.x, y: inner.y, width: inner.width, height: inner.height },
    duration,
    ease,
  }, position);
  timeline.to([refs.stringGlow, refs.string], {
    attr: { x2: frame.x + frame.width, y2: frame.y },
    duration,
    ease,
  }, position);
  timeline.to(refs.corners, {
    attr: { d: getCornerPath(frame.x, frame.y, frame.width, frame.height, 12) },
    duration,
    ease,
  }, position);
  timeline.to(refs.grabPoint, {
    attr: { cx: frame.x + frame.width, cy: frame.y },
    duration,
    ease,
  }, position);
  refs.dots.forEach((dot, index) => {
    timeline.to(dot, {
      attr: { cx: dots[index].x, cy: dots[index].y },
      duration,
      ease,
    }, position);
  });
}

export default function ScreenTransition({
  active,
  outgoing,
  incoming,
  duration = 1.55,
  selectionSelector = ".intro-full-name",
  onComplete,
}) {
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const mechanismRef = useRef(null);
  const stringGlowRef = useRef(null);
  const stringRef = useRef(null);
  const boxRef = useRef(null);
  const innerBoxRef = useRef(null);
  const cornersRef = useRef(null);
  const anchorRef = useRef(null);
  const grabPointRef = useRef(null);
  const dotsGroupRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const [finished, setFinished] = useState(false);

  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    const mechanism = mechanismRef.current;
    const stringGlow = stringGlowRef.current;
    const string = stringRef.current;
    const box = boxRef.current;
    const innerBox = innerBoxRef.current;
    const corners = cornersRef.current;
    const anchor = anchorRef.current;
    const grabPoint = grabPointRef.current;
    const dotsGroup = dotsGroupRef.current;
    const dots = dotsGroup ? Array.from(dotsGroup.querySelectorAll("circle")) : [];

    if (
      !active || finished || !root || !panel || !mechanism ||
      !stringGlow || !string || !box || !innerBox || !corners || !anchor ||
      !grabPoint || dots.length !== DOT_COUNT
    ) {
      return undefined;
    }

    let cancelled = false;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setFinished(true);
        onCompleteRef.current?.();
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(frame);
      };
    }

    const selection = selectionSelector ? panel.querySelector(selectionSelector) : null;
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width;
    const panelHeight = panelRect.height;
    const selectionRect = selection?.getBoundingClientRect();
    const horizontalPadding = 14;
    const verticalPadding = 10;
    const targetFrame = selectionRect
      ? {
          x: selectionRect.left - panelRect.left - horizontalPadding,
          y: selectionRect.top - panelRect.top - verticalPadding,
          width: selectionRect.width + horizontalPadding * 2,
          height: selectionRect.height + verticalPadding * 2,
        }
      : { x: panelWidth * 0.35, y: panelHeight * 0.44, width: panelWidth * 0.3, height: 48 };
    const startFrame = {
      x: panelWidth - 36,
      y: 8,
      width: 28,
      height: 28,
    };
    const startInner = getInnerFrame(startFrame);
    const startDots = getPerimeterPoints(startFrame);
    const startCornerPath = getCornerPath(
      startFrame.x,
      startFrame.y,
      startFrame.width,
      startFrame.height,
      8,
    );

    mechanism.setAttribute("viewBox", `0 0 ${panelWidth} ${panelHeight}`);
    mechanism.setAttribute("width", `${panelWidth}`);
    mechanism.setAttribute("height", `${panelHeight}`);
    stringGlow.setAttribute("x1", `${panelWidth}`);
    stringGlow.setAttribute("y1", "0");
    string.setAttribute("x1", `${panelWidth}`);
    string.setAttribute("y1", "0");
    [stringGlow, string].forEach((line) => {
      line.setAttribute("x2", `${startFrame.x + startFrame.width}`);
      line.setAttribute("y2", `${startFrame.y}`);
    });
    box.setAttribute("x", `${startFrame.x}`);
    box.setAttribute("y", `${startFrame.y}`);
    box.setAttribute("width", `${startFrame.width}`);
    box.setAttribute("height", `${startFrame.height}`);
    innerBox.setAttribute("x", `${startInner.x}`);
    innerBox.setAttribute("y", `${startInner.y}`);
    innerBox.setAttribute("width", `${startInner.width}`);
    innerBox.setAttribute("height", `${startInner.height}`);
    corners.setAttribute("d", startCornerPath);
    anchor.setAttribute("cx", `${panelWidth - 1.5}`);
    anchor.setAttribute("cy", "1.5");
    grabPoint.setAttribute("cx", `${startFrame.x + startFrame.width}`);
    grabPoint.setAttribute("cy", `${startFrame.y}`);
    dots.forEach((dot, index) => {
      dot.setAttribute("cx", `${startDots[index].x}`);
      dot.setAttribute("cy", `${startDots[index].y}`);
    });

    // Scaling around the top-right keeps the string's screen-corner pivot fixed.
    const projectFrame = (scale, x = 0, y = 0) => ({
      x: panelWidth + (targetFrame.x - panelWidth) * scale + x,
      y: targetFrame.y * scale + y,
      width: targetFrame.width * scale,
      height: targetFrame.height * scale,
    });
    const wrapStart = 0.06;
    const wrapDuration = 0.62;
    const pullPause = 0.6;
    const pullStart = wrapStart + wrapDuration + pullPause;
    const pullDuration = Math.max(1.38, duration - pullStart);
    const liftX = panelWidth * 0.72;
    const liftY = -panelHeight * 1.08;
    const liftedFrame = projectFrame(0.7, liftX, liftY);
    const refs = { box, innerBox, stringGlow, string, corners, grabPoint, dots };

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        onComplete: () => {
          if (cancelled) return;
          setFinished(true);
          onCompleteRef.current?.();
        },
      });

      timeline.fromTo(
        mechanism,
        { opacity: 0 },
        { opacity: 1, duration: 0.22, ease: "power1.out" },
        0,
      );
      addFrameTweens(timeline, refs, targetFrame, wrapDuration, "power1.inOut", wrapStart);

      timeline.to(panel, {
        scale: 0.7,
        x: liftX,
        y: liftY,
        duration: pullDuration,
        ease: "none",
        transformOrigin: "top right",
      }, pullStart);
      addFrameTweens(timeline, refs, liftedFrame, pullDuration, "none", pullStart);
    }, root);

    return () => {
      cancelled = true;
      context.revert();
    };
  }, [active, duration, finished, selectionSelector]);

  return (
    <div
      ref={rootRef}
      className={`screen-transition${finished ? " screen-transition--finished" : ""}`}
    >
      <div
        className="screen-transition__incoming"
        aria-hidden={!finished}
        inert={!finished}
      >
        {incoming}
      </div>

      {!finished && (
        <>
          <div ref={panelRef} className="screen-transition__outgoing">
            {outgoing}
          </div>
          <svg
            ref={mechanismRef}
            className="screen-transition__mechanism"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line ref={stringGlowRef} className="screen-transition__string-glow" />
            <line ref={stringRef} className="screen-transition__string" />
            <rect ref={boxRef} className="screen-transition__grab-box" />
            <rect ref={innerBoxRef} className="screen-transition__inner-box" />
            <path ref={cornersRef} className="screen-transition__corners" />
            <circle ref={anchorRef} className="screen-transition__anchor" r="3.5" />
            <circle ref={grabPointRef} className="screen-transition__grab-point" r="2.5" />
            <g ref={dotsGroupRef} className="screen-transition__box-dots">
              {Array.from({ length: DOT_COUNT }, (_, index) => (
                <circle
                  key={index}
                  className="screen-transition__box-dot"
                  r={index >= DOT_COUNT - 4 || index % 4 === 0 ? 2.2 : 1.5}
                />
              ))}
            </g>
          </svg>
        </>
      )}
    </div>
  );
}


